-- PLAN PLANTA | Ejecutar una vez en Supabase > SQL Editor
-- Para usar la app, habilita Authentication > Providers > Anonymous Sign-Ins.
-- RLS aísla los registros de cada visitante; la clave publica no accede a datos ajenos.

create extension if not exists pgcrypto;

create table if not exists public.purification_cycles (
    id text primary key,
    owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    created_at timestamptz not null default now(),
    filter_code text not null check (filter_code in ('comboVent','combo','hepa','carbon','vent')),
    filter_name text not null,
    duration_minutes integer not null check (duration_minutes between 1 and 120),
    is_demo boolean not null default false,
    pm25_in numeric(12,2) not null check (pm25_in >= 0),
    pm25_out numeric(12,2) not null check (pm25_out >= 0),
    pm10_in numeric(12,2) not null check (pm10_in >= 0),
    pm10_out numeric(12,2) not null check (pm10_out >= 0),
    co2_in numeric(12,2) not null check (co2_in >= 0),
    co2_out numeric(12,2) not null check (co2_out >= 0),
    co_in numeric(12,2) not null check (co_in >= 0),
    co_out numeric(12,2) not null check (co_out >= 0),
    reduction_pm25_pct numeric(6,2) generated always as (
      case when pm25_in > 0 then round(greatest(0,100*(pm25_in-pm25_out)/pm25_in),2) else 0 end
    ) stored,
    reduction_pm10_pct numeric(6,2) generated always as (
      case when pm10_in > 0 then round(greatest(0,100*(pm10_in-pm10_out)/pm10_in),2) else 0 end
    ) stored,
    reduction_co2_pct numeric(6,2) generated always as (
      case when co2_in > 0 then round(greatest(0,100*(co2_in-co2_out)/co2_in),2) else 0 end
    ) stored,
    reduction_co_pct numeric(6,2) generated always as (
      case when co_in > 0 then round(greatest(0,100*(co_in-co_out)/co_in),2) else 0 end
    ) stored
);

create table if not exists public.alert_actions (
    id text primary key,
    owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    created_at timestamptz not null default now(),
    contaminant text not null check (contaminant in ('pm25','pm10','co2','co','coLow')),
    action_name text not null,
    description text not null,
    is_simulation boolean not null default true
);

create index if not exists purification_cycles_owner_time_idx on public.purification_cycles(owner_id, created_at desc);
create index if not exists alert_actions_owner_time_idx on public.alert_actions(owner_id, created_at desc);

alter table public.purification_cycles enable row level security;
alter table public.alert_actions enable row level security;

-- Políticas reutilizables al correr nuevamente el script.
drop policy if exists cycles_select_own on public.purification_cycles;
drop policy if exists cycles_insert_own on public.purification_cycles;
drop policy if exists cycles_update_own on public.purification_cycles;
drop policy if exists cycles_delete_own on public.purification_cycles;
create policy cycles_select_own on public.purification_cycles for select to authenticated using ((select auth.uid()) = owner_id);
create policy cycles_insert_own on public.purification_cycles for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy cycles_update_own on public.purification_cycles for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy cycles_delete_own on public.purification_cycles for delete to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists actions_select_own on public.alert_actions;
drop policy if exists actions_insert_own on public.alert_actions;
drop policy if exists actions_update_own on public.alert_actions;
drop policy if exists actions_delete_own on public.alert_actions;
create policy actions_select_own on public.alert_actions for select to authenticated using ((select auth.uid()) = owner_id);
create policy actions_insert_own on public.alert_actions for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy actions_update_own on public.alert_actions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy actions_delete_own on public.alert_actions for delete to authenticated using ((select auth.uid()) = owner_id);

-- El acceso se hace con la clave PUBLICA y una sesión autenticada anónima.
-- No utilizar service_role ni desactivar RLS.
