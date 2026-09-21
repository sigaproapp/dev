-- Execute este arquivo no SQL Editor do Supabase.
-- O acesso Master continua usando Supabase Auth.
-- Os usuários da equipe usam esta autenticação própria, sem senha no localStorage.

create extension if not exists pgcrypto;

create table if not exists public.humor_registros (
    id uuid primary key default gen_random_uuid(),
    loja_id uuid not null references public.lojas(id) on delete cascade,
    vendedor_id uuid not null references public.perfis(id) on delete cascade,
    data date not null,
    humor text not null,
    updated_at timestamptz not null default now()
);

create unique index if not exists humor_registros_vendedor_data_key
    on public.humor_registros (vendedor_id, data);

grant select, insert, update, delete on public.humor_registros to anon, authenticated;
alter table public.humor_registros enable row level security;
drop policy if exists humor_registros_anon_all on public.humor_registros;
create policy humor_registros_anon_all
    on public.humor_registros for all to anon, authenticated
    using (true)
    with check (true);

create table if not exists public.condicionais (
    id uuid primary key default gen_random_uuid(),
    loja_id uuid not null references public.lojas(id) on delete cascade,
    vendedor_id uuid not null references public.perfis(id) on delete cascade,
    cliente text not null default '',
    telefone text default '',
    observacao text default '',
    produtos jsonb not null default '[]'::jsonb,
    prazo timestamptz,
    status text not null default 'aberta',
    task_id uuid,
    created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.condicionais to anon, authenticated;
alter table public.condicionais enable row level security;
drop policy if exists condicionais_anon_all on public.condicionais;
create policy condicionais_anon_all
    on public.condicionais for all to anon, authenticated
    using (true)
    with check (true);

create table if not exists public.atendimentos (
    id uuid primary key default gen_random_uuid(),
    loja_id uuid not null references public.lojas(id) on delete cascade,
    vendedor_id uuid not null references public.perfis(id) on delete cascade,
    cliente text not null default '',
    resultado text not null default 'other',
    resultado_label text not null default '',
    valor numeric(12,2) not null default 0,
    telefone text default '',
    observacao text default '',
    produtos jsonb not null default '[]'::jsonb,
    produtos_apresentados jsonb not null default '[]'::jsonb,
    demanda text default '',
    venda_id uuid,
    condicional_id uuid references public.condicionais(id) on delete set null,
    data_hora timestamptz not null default now()
);

grant select, insert, update, delete on public.atendimentos to anon, authenticated;
alter table public.atendimentos enable row level security;
drop policy if exists atendimentos_anon_all on public.atendimentos;
create policy atendimentos_anon_all
    on public.atendimentos for all to anon, authenticated
    using (true)
    with check (true);

do $$
begin
    if to_regclass('public.atendimentos') is not null then
        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'atendimentos'
              and column_name = 'condicinal_id'
        )
        and not exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'atendimentos'
              and column_name = 'condicional_id'
        ) then
            alter table public.atendimentos rename column condicinal_id to condicional_id;
        end if;

        alter table public.atendimentos drop constraint if exists atendimentos_condicinal_id_fkey;
        alter table public.atendimentos drop constraint if exists atendimentos_condicional_id_fkey;
        alter table public.atendimentos
            add constraint atendimentos_condicional_id_fkey
            foreign key (condicional_id) references public.condicionais(id) on delete set null;
    end if;
end $$;

create table if not exists public.prospeccao_listas (
    id uuid primary key default gen_random_uuid(),
    loja_id uuid not null references public.lojas(id) on delete cascade,
    owner_id uuid references public.perfis(id) on delete cascade,
    nome text not null,
    dias_disponiveis jsonb not null default '[]'::jsonb,
    contatos jsonb not null default '[]'::jsonb,
    mensagens jsonb not null default '[]'::jsonb,
    tarefa_horario time,
    tarefa_meta_tipo text not null default 'minimum',
    tarefa_meta_valor integer not null default 1,
    tarefa_vendedores jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.prospeccao_listas
    add column if not exists owner_id uuid references public.perfis(id) on delete cascade;
alter table public.prospeccao_listas add column if not exists tarefa_horario time;
alter table public.prospeccao_listas add column if not exists tarefa_meta_tipo text not null default 'minimum';
alter table public.prospeccao_listas add column if not exists tarefa_meta_valor integer not null default 1;
alter table public.prospeccao_listas add column if not exists tarefa_vendedores jsonb not null default '[]'::jsonb;

grant select, insert, update, delete on public.prospeccao_listas to anon, authenticated;

alter table public.prospeccao_listas enable row level security;

drop policy if exists prospeccao_listas_anon_all on public.prospeccao_listas;
create policy prospeccao_listas_anon_all
    on public.prospeccao_listas for all to anon, authenticated
    using (true)
    with check (true);

create table if not exists public.treinamento_modulos (
    id uuid primary key default gen_random_uuid(),
    loja_id uuid not null references public.lojas(id) on delete cascade,
    titulo text not null,
    ordem integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.treinamento_modulos to anon, authenticated;
alter table public.treinamento_modulos enable row level security;
drop policy if exists treinamento_modulos_anon_all on public.treinamento_modulos;
create policy treinamento_modulos_anon_all
    on public.treinamento_modulos for all to anon, authenticated
    using (true)
    with check (true);

create table if not exists public.treinamentos (
    id uuid primary key default gen_random_uuid(),
    loja_id uuid not null references public.lojas(id) on delete cascade,
    modulo_id uuid,
    titulo text not null,
    video_url text default '',
    audio_url text default '',
    pdf_url text default '',
    disponibilidade jsonb not null default '{}'::jsonb,
    vendedor_ids jsonb not null default '[]'::jsonb,
    perguntas jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.treinamentos
    add column if not exists audio_url text default '';
alter table public.treinamentos
    add column if not exists modulo_id uuid;

grant select, insert, update, delete on public.treinamentos to anon, authenticated;
alter table public.treinamentos enable row level security;
drop policy if exists treinamentos_anon_all on public.treinamentos;
create policy treinamentos_anon_all
    on public.treinamentos for all to anon, authenticated
    using (true)
    with check (true);

-- Compatibilidade com a coluna antiga de senha, caso ainda exista no projeto.
do $$
begin
    if to_regclass('public.perfis') is not null
       and exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'perfis'
             and column_name = 'password'
       ) then
        alter table public.perfis alter column password drop not null;
    end if;
end;
$$;

alter table public.perfis
    add column if not exists password_hash text;

drop function if exists public.admin_save_profile(uuid, uuid, text, text, text, text, text, text);

create or replace function public.admin_save_profile(
    p_id uuid,
    p_loja_id uuid,
    p_nome text,
    p_cargo text,
    p_username text,
    p_slug text,
    p_full_slug text,
    p_password text default null
)
returns table (
    id uuid,
    loja_id uuid,
    nome text,
    cargo text,
    username text,
    slug text,
    full_slug text,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_created_at timestamptz;
    v_cargo public.perfis.cargo%type;
    v_password_hash text;
begin
    if auth.uid() is null then
        raise exception 'Acesso administrativo exige autenticação';
    end if;

    if p_password is not null and p_password !~ '^[0-9]+$' then
        raise exception 'A senha deve conter apenas números';
    end if;

    select p.created_at
    into v_created_at
    from public.perfis as p
    where p.id = $1;

    v_created_at := coalesce(v_created_at, now());
    v_cargo := p_cargo;
    v_password_hash := case
        when p_password is null then null
        else crypt(p_password, gen_salt('bf', 10))
    end;

    update public.perfis as current_profile
    set loja_id = p_loja_id,
        nome = p_nome,
        cargo = v_cargo,
        username = p_username,
        slug = p_slug,
        full_slug = p_full_slug,
        password_hash = case
            when p_password is null then current_profile.password_hash
            else v_password_hash
        end
    where current_profile.id = p_id;

    if not found then
        insert into public.perfis (
            id, loja_id, nome, cargo, username, slug, full_slug, password_hash, created_at
        ) values (
            p_id, p_loja_id, p_nome, v_cargo, p_username, p_slug, p_full_slug,
            v_password_hash, v_created_at
        );
    end if;

    return query
        select profile.id, profile.loja_id, profile.nome, profile.cargo::text, profile.username, profile.slug, profile.full_slug, profile.created_at
        from public.perfis as profile
        where profile.id = $1;
end;
$$;

drop function if exists public.verify_profile_password(uuid, text);

create or replace function public.verify_profile_password(
    p_profile_id uuid,
    p_password text
)
returns table (
    id uuid,
    loja_id uuid,
    nome text,
    cargo text,
    username text,
    slug text,
    full_slug text,
    created_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as $$
    select p.id, p.loja_id, p.nome, p.cargo::text, p.username, p.slug, p.full_slug, p.created_at
    from public.perfis as p
    where p.id = p_profile_id
      and p_password is not null
      and p_password ~ '^[0-9]+$'
      and p.password_hash is not null
      and p.password_hash = crypt(p_password, p.password_hash);
$$;

revoke all on function public.admin_save_profile(uuid, uuid, text, text, text, text, text, text) from public;
revoke all on function public.verify_profile_password(uuid, text) from public;
grant execute on function public.admin_save_profile(uuid, uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.verify_profile_password(uuid, text) to anon, authenticated;

-- Não permita leitura pública do hash.
revoke select on public.perfis from anon;
grant select (id, loja_id, nome, cargo, username, slug, full_slug, created_at) on public.perfis to anon, authenticated;
