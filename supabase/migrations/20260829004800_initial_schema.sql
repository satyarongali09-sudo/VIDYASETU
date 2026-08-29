create extension if not exists "pgcrypto";

create type public.user_role as enum ('teacher', 'student');
create type public.session_status as enum ('scheduled', 'live', 'ended', 'cancelled');
create type public.attendance_status as enum ('present', 'late', 'absent');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  subject text not null,
  description text,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.classroom_members (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (classroom_id, student_id)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  title text not null,
  status public.session_status not null default 'scheduled',
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  question text not null,
  options jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.poll_responses (
  poll_id uuid not null references public.polls(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  selected_option text not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, student_id)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_answered boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.attendance (
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.attendance_status not null default 'present',
  marked_at timestamptz not null default now(),
  primary key (session_id, student_id)
);

create table public.live_events (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.sessions enable row level security;
alter table public.polls enable row level security;
alter table public.poll_responses enable row level security;
alter table public.questions enable row level security;
alter table public.attendance enable row level security;
alter table public.live_events enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.classrooms to authenticated;
grant select, insert, delete on public.classroom_members to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.polls to authenticated;
grant select, insert, update on public.poll_responses to authenticated;
grant select, insert, update on public.questions to authenticated;
grant select, insert, update on public.attendance to authenticated;
grant select, insert on public.live_events to authenticated;

create policy "profiles are visible to signed in users"
on public.profiles for select
to authenticated
using (true);

create policy "users create their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "users update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "teachers manage own classrooms"
on public.classrooms for all
to authenticated
using ((select auth.uid()) = teacher_id)
with check ((select auth.uid()) = teacher_id);

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

create policy "teachers view members in own classrooms"
on public.classroom_members for select
to authenticated
using (
  exists (
    select 1 from public.classrooms
    where classrooms.id = classroom_members.classroom_id
    and classrooms.teacher_id = (select auth.uid())
  )
);

create policy "students view own memberships"
on public.classroom_members for select
to authenticated
using ((select auth.uid()) = student_id);

create policy "students join as themselves"
on public.classroom_members for insert
to authenticated
with check ((select auth.uid()) = student_id);

create policy "students leave own classrooms"
on public.classroom_members for delete
to authenticated
using ((select auth.uid()) = student_id);

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

create policy "teachers manage sessions"
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

create policy "class participants view polls"
on public.polls for select
to authenticated
using (
  exists (
    select 1 from public.sessions
    join public.classrooms on classrooms.id = sessions.classroom_id
    left join public.classroom_members on classroom_members.classroom_id = classrooms.id
    where sessions.id = polls.session_id
    and (
      classrooms.teacher_id = (select auth.uid())
      or classroom_members.student_id = (select auth.uid())
    )
  )
);

create policy "teachers manage polls"
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

create policy "class participants view poll responses"
on public.poll_responses for select
to authenticated
using (
  student_id = (select auth.uid())
  or exists (
    select 1 from public.polls
    join public.sessions on sessions.id = polls.session_id
    join public.classrooms on classrooms.id = sessions.classroom_id
    where polls.id = poll_responses.poll_id
    and classrooms.teacher_id = (select auth.uid())
  )
);

create policy "students answer polls as themselves"
on public.poll_responses for insert
to authenticated
with check (student_id = (select auth.uid()));

create policy "students update own poll responses"
on public.poll_responses for update
to authenticated
using (student_id = (select auth.uid()))
with check (student_id = (select auth.uid()));

create policy "class participants view questions"
on public.questions for select
to authenticated
using (
  student_id = (select auth.uid())
  or exists (
    select 1 from public.sessions
    join public.classrooms on classrooms.id = sessions.classroom_id
    where sessions.id = questions.session_id
    and classrooms.teacher_id = (select auth.uid())
  )
);

create policy "students ask questions as themselves"
on public.questions for insert
to authenticated
with check (student_id = (select auth.uid()));

create policy "teachers mark questions answered"
on public.questions for update
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

create policy "class participants view attendance"
on public.attendance for select
to authenticated
using (
  student_id = (select auth.uid())
  or exists (
    select 1 from public.sessions
    join public.classrooms on classrooms.id = sessions.classroom_id
    where sessions.id = attendance.session_id
    and classrooms.teacher_id = (select auth.uid())
  )
);

create policy "students mark own attendance"
on public.attendance for insert
to authenticated
with check (student_id = (select auth.uid()));

create policy "students update own attendance"
on public.attendance for update
to authenticated
using (student_id = (select auth.uid()))
with check (student_id = (select auth.uid()));

create policy "class participants view live events"
on public.live_events for select
to authenticated
using (
  exists (
    select 1 from public.classrooms
    where classrooms.id = live_events.classroom_id
    and classrooms.teacher_id = (select auth.uid())
  )
  or exists (
    select 1 from public.classroom_members
    where classroom_members.classroom_id = live_events.classroom_id
    and classroom_members.student_id = (select auth.uid())
  )
);

create policy "class participants create live events"
on public.live_events for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    exists (
      select 1 from public.classrooms
      where classrooms.id = live_events.classroom_id
      and classrooms.teacher_id = (select auth.uid())
    )
    or exists (
      select 1 from public.classroom_members
      where classroom_members.classroom_id = live_events.classroom_id
      and classroom_members.student_id = (select auth.uid())
    )
  )
);

insert into storage.buckets (id, name, public)
values
  ('slides', 'slides', false),
  ('audio', 'audio', false),
  ('recordings', 'recordings', false)
on conflict (id) do nothing;

create policy "class participants read class media"
on storage.objects for select
to authenticated
using (
  bucket_id in ('slides', 'audio', 'recordings')
  and (
    exists (
      select 1 from public.classrooms
      where classrooms.id = split_part(storage.objects.name, '/', 1)::uuid
      and classrooms.teacher_id = (select auth.uid())
    )
    or exists (
      select 1 from public.classroom_members
      where classroom_members.classroom_id = split_part(storage.objects.name, '/', 1)::uuid
      and classroom_members.student_id = (select auth.uid())
    )
  )
);

create policy "teachers upload class media"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('slides', 'audio', 'recordings')
  and exists (
    select 1 from public.classrooms
    where classrooms.id = split_part(storage.objects.name, '/', 1)::uuid
    and classrooms.teacher_id = (select auth.uid())
  )
);

create policy "teachers replace class media"
on storage.objects for update
to authenticated
using (
  bucket_id in ('slides', 'audio', 'recordings')
  and exists (
    select 1 from public.classrooms
    where classrooms.id = split_part(storage.objects.name, '/', 1)::uuid
    and classrooms.teacher_id = (select auth.uid())
  )
)
with check (
  bucket_id in ('slides', 'audio', 'recordings')
  and exists (
    select 1 from public.classrooms
    where classrooms.id = split_part(storage.objects.name, '/', 1)::uuid
    and classrooms.teacher_id = (select auth.uid())
  )
);
