-- Evolve the initial VIDYASETU schema without dropping existing application data.
create extension if not exists "pgcrypto";

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.set_row_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles retain identity data from Supabase Auth. Email remains nullable so
-- legacy profiles without an email do not block this non-destructive migration.
alter table public.profiles
  add column if not exists email text,
  add column if not exists updated_at timestamptz;

update public.profiles as profile
set email = auth_user.email
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.email is null;

update public.profiles
set updated_at = created_at
where updated_at is null;

alter table public.profiles
  alter column updated_at set default now(),
  alter column updated_at set not null;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_row_updated_at();

-- Classrooms already have UUID IDs and a unique invite-code constraint. Update
-- the default code generator and add the requested modification timestamp.
alter table public.classrooms
  add column if not exists updated_at timestamptz;

update public.classrooms
set updated_at = created_at
where updated_at is null;

alter table public.classrooms
  alter column invite_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  alter column updated_at set default now(),
  alter column updated_at set not null;

drop trigger if exists classrooms_set_updated_at on public.classrooms;
create trigger classrooms_set_updated_at
before update on public.classrooms
for each row execute function private.set_row_updated_at();

-- Add surrogate UUID keys while retaining uniqueness of each membership.
alter table public.classroom_members
  add column if not exists id uuid;

update public.classroom_members
set id = gen_random_uuid()
where id is null;

alter table public.classroom_members
  alter column id set default gen_random_uuid(),
  alter column id set not null;

alter table public.classroom_members
  drop constraint if exists classroom_members_pkey,
  add constraint classroom_members_pkey primary key (id),
  add constraint classroom_members_classroom_student_key unique (classroom_id, student_id);

-- Sessions already provide the requested UUID, classroom relationship, status,
-- start/end timestamps, and creation timestamp. Keep the existing cancelled
-- enum member for backward compatibility and enforce valid time ordering.
alter table public.sessions
  drop constraint if exists sessions_end_after_start,
  add constraint sessions_end_after_start
    check (ended_at is null or started_at is null or ended_at >= started_at) not valid;

-- Poll response identity is normalized to a UUID primary key while preserving
-- the one-response-per-student rule.
alter table public.poll_responses
  add column if not exists id uuid;

update public.poll_responses
set id = gen_random_uuid()
where id is null;

alter table public.poll_responses
  alter column id set default gen_random_uuid(),
  alter column id set not null;

alter table public.poll_responses
  drop constraint if exists poll_responses_pkey,
  add constraint poll_responses_pkey primary key (id),
  add constraint poll_responses_poll_student_key unique (poll_id, student_id);

alter table public.polls
  drop constraint if exists polls_options_array_check,
  add constraint polls_options_array_check
    check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2) not valid;

-- Preserve the legacy body column used by the current API while introducing the
-- canonical question field and teacher-answer metadata.
alter table public.questions
  add column if not exists question text,
  add column if not exists answer text,
  add column if not exists answered_by uuid references public.profiles(id) on delete set null,
  add column if not exists answered_at timestamptz;

update public.questions
set question = body
where question is null;

alter table public.questions
  alter column question set not null,
  drop constraint if exists questions_answer_metadata_check,
  add constraint questions_answer_metadata_check
    check (
      (answer is null and answered_by is null and answered_at is null)
      or (answer is not null and answered_by is not null and answered_at is not null)
    ) not valid;

-- Attendance gains a UUID identity and live-presence fields without removing
-- marked_at, which remains available to existing API clients.
alter table public.attendance
  add column if not exists id uuid,
  add column if not exists joined_at timestamptz,
  add column if not exists left_at timestamptz,
  add column if not exists duration_seconds integer,
  add column if not exists created_at timestamptz;

update public.attendance
set id = gen_random_uuid()
where id is null;

update public.attendance
set joined_at = marked_at
where joined_at is null;

update public.attendance
set duration_seconds = 0
where duration_seconds is null;

update public.attendance
set created_at = marked_at
where created_at is null;

alter table public.attendance
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column joined_at set default now(),
  alter column joined_at set not null,
  alter column duration_seconds set default 0,
  alter column duration_seconds set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  drop constraint if exists attendance_pkey,
  add constraint attendance_pkey primary key (id),
  add constraint attendance_session_student_key unique (session_id, student_id),
  add constraint attendance_duration_nonnegative check (duration_seconds >= 0),
  add constraint attendance_left_after_joined check (left_at is null or left_at >= joined_at);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text,
  file_url text not null,
  file_type text not null,
  file_size bigint not null check (file_size >= 0),
  created_at timestamptz not null default now()
);

-- Query indexes follow the foreign-key and ownership access paths used by the
-- API and RLS policies. Existing unique constraints already index invite_code.
create index if not exists classrooms_teacher_id_idx on public.classrooms (teacher_id);
create index if not exists classroom_members_classroom_id_idx on public.classroom_members (classroom_id);
create index if not exists classroom_members_student_id_idx on public.classroom_members (student_id);
create index if not exists sessions_classroom_id_idx on public.sessions (classroom_id);
create index if not exists attendance_session_id_idx on public.attendance (session_id);
create index if not exists attendance_student_id_idx on public.attendance (student_id);
create index if not exists polls_session_id_idx on public.polls (session_id);
create index if not exists poll_responses_poll_id_idx on public.poll_responses (poll_id);
create index if not exists poll_responses_student_id_idx on public.poll_responses (student_id);
create index if not exists questions_session_id_idx on public.questions (session_id);
create index if not exists questions_student_id_idx on public.questions (student_id);
create index if not exists materials_classroom_id_idx on public.materials (classroom_id);
create index if not exists materials_uploaded_by_idx on public.materials (uploaded_by);

-- Every application table is protected with RLS. The existing live_events
-- table remains protected by its initial migration policies.
alter table public.profiles enable row level security;
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.polls enable row level security;
alter table public.poll_responses enable row level security;
alter table public.questions enable row level security;
alter table public.materials enable row level security;

grant select, insert on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (email, full_name, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.classrooms to authenticated;
grant select, insert, update, delete on public.classroom_members to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
grant select, insert, update, delete on public.polls to authenticated;
grant select, insert on public.poll_responses to authenticated;
revoke update, delete on public.poll_responses from authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.materials to authenticated;

-- The membership table intentionally has no client-side INSERT policy. Students
-- enroll through this guarded RPC, which validates the invite code without
-- exposing other classroom records or allowing arbitrary membership inserts.
create or replace function public.join_classroom_by_invite(p_invite_code text)
returns public.classroom_members
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_classroom_id uuid;
  membership public.classroom_members;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'student'
  ) then
    raise exception 'Only student profiles can join a classroom.';
  end if;

  select id
  into target_classroom_id
  from public.classrooms
  where invite_code = upper(trim(p_invite_code));

  if target_classroom_id is null then
    raise exception 'Invalid classroom invite code.';
  end if;

  insert into public.classroom_members (classroom_id, student_id)
  values (target_classroom_id, auth.uid())
  on conflict (classroom_id, student_id) do update
    set student_id = excluded.student_id
  returning * into membership;

  return membership;
end;
$$;

revoke all on function public.join_classroom_by_invite(text) from public, anon;
grant execute on function public.join_classroom_by_invite(text) to authenticated;

drop policy if exists "profiles are visible to signed in users" on public.profiles;
drop policy if exists "users create their own profile" on public.profiles;
drop policy if exists "users update their own profile" on public.profiles;

create policy "users view their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "users create their own profile"
on public.profiles for insert
to authenticated
with check (
  (select auth.uid()) = id
  and email is not distinct from (select auth.jwt() ->> 'email')
);

create policy "users update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check (
  (select auth.uid()) = id
  and email is not distinct from (select auth.jwt() ->> 'email')
);

drop policy if exists "teachers manage own classrooms" on public.classrooms;
drop policy if exists "students view joined classrooms" on public.classrooms;

create policy "teachers manage owned classrooms"
on public.classrooms for all
to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'teacher'
  )
)
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'teacher'
  )
);

create policy "students view joined classrooms"
on public.classrooms for select
to authenticated
using (
  exists (
    select 1 from public.classroom_members
    where classroom_members.classroom_id = classrooms.id
      and classroom_members.student_id = (select auth.uid())
  )
);

drop policy if exists "teachers view members in own classrooms" on public.classroom_members;
drop policy if exists "students view own memberships" on public.classroom_members;
drop policy if exists "students join as themselves" on public.classroom_members;
drop policy if exists "students leave own classrooms" on public.classroom_members;

create policy "teachers manage members in owned classrooms"
on public.classroom_members for all
to authenticated
using (
  exists (
    select 1 from public.classrooms
    where classrooms.id = classroom_members.classroom_id
      and classrooms.teacher_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.classrooms
    where classrooms.id = classroom_members.classroom_id
      and classrooms.teacher_id = (select auth.uid())
  )
);

create policy "students view own memberships"
on public.classroom_members for select
to authenticated
using (student_id = (select auth.uid()));

create policy "students leave own classrooms"
on public.classroom_members for delete
to authenticated
using (student_id = (select auth.uid()));

drop policy if exists "class participants view sessions" on public.sessions;
drop policy if exists "teachers manage sessions" on public.sessions;

create policy "class participants view sessions"
on public.sessions for select
to authenticated
using (
  exists (
    select 1 from public.classrooms
    where classrooms.id = sessions.classroom_id
      and classrooms.teacher_id = (select auth.uid())
  )
  or exists (
    select 1 from public.classroom_members
    where classroom_members.classroom_id = sessions.classroom_id
      and classroom_members.student_id = (select auth.uid())
  )
);

create policy "teachers manage sessions in owned classrooms"
on public.sessions for all
to authenticated
using (
  exists (
    select 1 from public.classrooms
    where classrooms.id = sessions.classroom_id
      and classrooms.teacher_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.classrooms
    where classrooms.id = sessions.classroom_id
      and classrooms.teacher_id = (select auth.uid())
  )
);

drop policy if exists "class participants view polls" on public.polls;
drop policy if exists "teachers manage polls" on public.polls;

create policy "class participants view polls"
on public.polls for select
to authenticated
using (
  exists (
    select 1 from public.sessions
    join public.classrooms on classrooms.id = sessions.classroom_id
    where sessions.id = polls.session_id
      and (
        classrooms.teacher_id = (select auth.uid())
        or exists (
          select 1 from public.classroom_members
          where classroom_members.classroom_id = classrooms.id
            and classroom_members.student_id = (select auth.uid())
        )
      )
  )
);

create policy "teachers manage polls in owned classrooms"
on public.polls for all
to authenticated
using (
  exists (
    select 1 from public.sessions
    join public.classrooms on classrooms.id = sessions.classroom_id
    where sessions.id = polls.session_id
      and classrooms.teacher_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.sessions
    join public.classrooms on classrooms.id = sessions.classroom_id
    where sessions.id = polls.session_id
      and classrooms.teacher_id = (select auth.uid())
  )
);

drop policy if exists "class participants view poll responses" on public.poll_responses;
drop policy if exists "students answer polls as themselves" on public.poll_responses;
drop policy if exists "students update own poll responses" on public.poll_responses;

create policy "students view own poll responses"
on public.poll_responses for select
to authenticated
using (student_id = (select auth.uid()));

create policy "teachers view poll responses in owned classrooms"
on public.poll_responses for select
to authenticated
using (
  exists (
    select 1 from public.polls
    join public.sessions on sessions.id = polls.session_id
    join public.classrooms on classrooms.id = sessions.classroom_id
    where polls.id = poll_responses.poll_id
      and classrooms.teacher_id = (select auth.uid())
  )
);

create policy "students submit one response to active classroom polls"
on public.poll_responses for insert
to authenticated
with check (
  student_id = (select auth.uid())
  and exists (
    select 1 from public.polls
    join public.sessions on sessions.id = polls.session_id
    join public.classroom_members on classroom_members.classroom_id = sessions.classroom_id
    where polls.id = poll_responses.poll_id
      and polls.is_active
      and classroom_members.student_id = (select auth.uid())
  )
);

drop policy if exists "class participants view questions" on public.questions;
drop policy if exists "students ask questions as themselves" on public.questions;
drop policy if exists "teachers mark questions answered" on public.questions;

create policy "students view own questions"
on public.questions for select
to authenticated
using (student_id = (select auth.uid()));

create policy "teachers view questions in owned classrooms"
on public.questions for select
to authenticated
using (
  exists (
    select 1 from public.sessions
    join public.classrooms on classrooms.id = sessions.classroom_id
    where sessions.id = questions.session_id
      and classrooms.teacher_id = (select auth.uid())
  )
);

create policy "students ask questions in joined classrooms"
on public.questions for insert
to authenticated
with check (
  student_id = (select auth.uid())
  and answer is null
  and answered_by is null
  and answered_at is null
  and is_answered is false
  and exists (
    select 1 from public.sessions
    join public.classroom_members on classroom_members.classroom_id = sessions.classroom_id
    where sessions.id = questions.session_id
      and classroom_members.student_id = (select auth.uid())
  )
);

create policy "students update their unanswered questions"
on public.questions for update
to authenticated
using (
  student_id = (select auth.uid())
  and answer is null
  and answered_by is null
  and answered_at is null
  and is_answered is false
)
with check (
  student_id = (select auth.uid())
  and answer is null
  and answered_by is null
  and answered_at is null
  and is_answered is false
);

create policy "teachers manage questions in owned classrooms"
on public.questions for all
to authenticated
using (
  exists (
    select 1 from public.sessions
    join public.classrooms on classrooms.id = sessions.classroom_id
    where sessions.id = questions.session_id
      and classrooms.teacher_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.sessions
    join public.classrooms on classrooms.id = sessions.classroom_id
    where sessions.id = questions.session_id
      and classrooms.teacher_id = (select auth.uid())
  )
);

drop policy if exists "class participants view attendance" on public.attendance;
drop policy if exists "students mark own attendance" on public.attendance;
drop policy if exists "students update own attendance" on public.attendance;

create policy "students view own attendance"
on public.attendance for select
to authenticated
using (student_id = (select auth.uid()));

create policy "teachers manage attendance in owned classrooms"
on public.attendance for all
to authenticated
using (
  exists (
    select 1 from public.sessions
    join public.classrooms on classrooms.id = sessions.classroom_id
    where sessions.id = attendance.session_id
      and classrooms.teacher_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.sessions
    join public.classrooms on classrooms.id = sessions.classroom_id
    where sessions.id = attendance.session_id
      and classrooms.teacher_id = (select auth.uid())
  )
);

create policy "students record their own attendance in joined classrooms"
on public.attendance for insert
to authenticated
with check (
  student_id = (select auth.uid())
  and exists (
    select 1 from public.sessions
    join public.classroom_members on classroom_members.classroom_id = sessions.classroom_id
    where sessions.id = attendance.session_id
      and classroom_members.student_id = (select auth.uid())
  )
);

create policy "students update their own attendance"
on public.attendance for update
to authenticated
using (student_id = (select auth.uid()))
with check (student_id = (select auth.uid()));

create policy "class participants view materials"
on public.materials for select
to authenticated
using (
  exists (
    select 1 from public.classrooms
    where classrooms.id = materials.classroom_id
      and classrooms.teacher_id = (select auth.uid())
  )
  or exists (
    select 1 from public.classroom_members
    where classroom_members.classroom_id = materials.classroom_id
      and classroom_members.student_id = (select auth.uid())
  )
);

create policy "teachers manage materials in owned classrooms"
on public.materials for all
to authenticated
using (
  exists (
    select 1 from public.classrooms
    where classrooms.id = materials.classroom_id
      and classrooms.teacher_id = (select auth.uid())
  )
)
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.classrooms
    where classrooms.id = materials.classroom_id
      and classrooms.teacher_id = (select auth.uid())
  )
);
