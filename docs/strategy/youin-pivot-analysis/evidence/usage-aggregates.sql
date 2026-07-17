-- Aggregate-only product evidence queried on July 17, 2026.
-- No profile names, emails, workspace names, page URLs, or other identifying
-- values were selected.

select
  (select count(*) from profiles)::int as profiles,
  (select count(*) from workspaces)::int as workspaces,
  (select count(*) from workspace_members)::int as members,
  (select count(*) from projects)::int as projects,
  (select count(*) from marks)::int as marks,
  (select count(*) from mark_comments)::int as comments,
  (select count(*) from workspace_review_links)::int as review_links;

select
  count(*) filter (where member_count > 1)::int as multi_member_workspaces,
  count(*) filter (where mark_count > 0)::int as workspaces_with_marks,
  coalesce(max(mark_count), 0)::int as max_marks_in_workspace
from (
  select
    w.id,
    count(distinct wm.user_id) as member_count,
    count(distinct m.id) as mark_count
  from workspaces w
  left join workspace_members wm on wm.workspace_id = w.id
  left join marks m on m.workspace_id = w.id
  group by w.id
) x;

select
  min(created_at) as first_mark_at,
  max(created_at) as latest_mark_at,
  count(*) filter (
    where created_at >= now() - interval '30 days'
  )::int as marks_last_30d
from marks;

select
  count(distinct created_by_user_id)::int as mark_creators,
  count(*) filter (where status = 'closed')::int as closed_marks,
  count(*) filter (where screenshot_url is not null)::int as marks_with_screenshot,
  count(*) filter (where dom_snapshot is not null)::int as marks_with_dom,
  count(*) filter (where assignee_user_id is not null)::int as assigned_marks
from marks;

select
  coalesce(capture_kind, 'unknown') as capture_kind,
  count(*)::int as marks
from marks
group by 1
order by 2 desc;

select
  count(*) filter (where last_used_at is not null)::int as used_review_links,
  count(*) filter (
    where revoked_at is null
      and (expires_at is null or expires_at > now())
  )::int as active_review_links
from workspace_review_links;

select
  count(distinct c.workspace_id)::int as collaborative_comment_workspaces,
  count(*)::int as cross_author_comments
from mark_comments c
join marks m
  on m.id = c.mark_id
  and m.workspace_id = c.workspace_id
where c.author_user_id <> m.created_by_user_id;

select
  count(*) filter (where type = 'prompt_copied')::int as prompt_copies,
  count(*) filter (where type = 'status_changed')::int as status_changes,
  count(*) filter (where type = 'assignee_changed')::int as assignee_changes
from mark_events;
