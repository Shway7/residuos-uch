-- ============================================================
-- Residuos UCH — esquema Postgres (Supabase)
-- Ejecutar una vez en el SQL Editor del proyecto.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.respuestas (
  id                uuid primary key default gen_random_uuid(),
  idempotency_key   text not null unique,
  sesion_id         text not null,
  survey_version    text not null default 'v2',
  perfil            text not null,
  conocia_codigo    text not null,
  utilidad          smallint not null,
  duracion_ms       integer,
  ip_hash           text,
  user_agent        text,
  origen            text not null default 'directo',
  created_at        timestamptz not null default now(),

  constraint perfil_valido check (
    perfil in ('estudiante_uch', 'docente', 'administrativo', 'vecino', 'transito')
  ),
  constraint conocia_valido check (
    conocia_codigo in ('si', 'mas_o_menos', 'no')
  ),
  constraint utilidad_valida check (
    utilidad >= 1 and utilidad <= 5
  ),
  constraint duracion_valida check (
    duracion_ms is null or (duracion_ms >= 0 and duracion_ms <= 3600000)
  )
);

create index if not exists respuestas_created_idx
  on public.respuestas (created_at desc);
create index if not exists respuestas_perfil_idx
  on public.respuestas (perfil);
create index if not exists respuestas_sesion_idx
  on public.respuestas (sesion_id);

create table if not exists public.eventos (
  id          bigserial primary key,
  sesion_id   text not null,
  tipo        text not null,
  punto_id    text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists eventos_tipo_idx
  on public.eventos (tipo, created_at desc);
create index if not exists eventos_sesion_idx
  on public.eventos (sesion_id);

-- Sin políticas para `anon`: solo el servidor (service_role) escribe y lee.
-- El frontend nunca habla directo con la base.
alter table public.respuestas enable row level security;
alter table public.eventos enable row level security;

-- ------------------------------------------------------------
-- Vistas para el informe
-- ------------------------------------------------------------

create or replace view public.v_indicadores as
select
  count(*)                                                       as encuestas,
  count(distinct sesion_id)                                      as participantes,
  round(avg(utilidad), 2)                                        as utilidad_prom,
  round(100.0 * count(*) filter (where utilidad >= 4)
        / nullif(count(*), 0), 1)                                as satisfaccion_pct,
  round(100.0 * count(*) filter (where conocia_codigo = 'si')
        / nullif(count(*), 0), 1)                                as decian_conocer_pct,
  round(avg(duracion_ms) / 1000.0, 1)                            as segundos_prom
from public.respuestas;

create or replace view public.v_autopercepcion as
select
  conocia_codigo          as autopercepcion,
  count(*)                as personas,
  round(avg(utilidad), 2) as utilidad_prom
from public.respuestas
group by 1
order by 1;

create or replace view public.v_embudo as
select
  tipo,
  count(*)                  as eventos,
  count(distinct sesion_id) as sesiones
from public.eventos
group by tipo
order by eventos desc;
