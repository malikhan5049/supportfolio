create table links (
  id uuid primary key,
  slug varchar(32) not null unique,
  target_url text not null,
  created_by varchar(255) not null,
  created_at timestamptz not null
);
create index idx_links_created_at on links (created_at desc);

create table link_clicks (
  id uuid primary key,
  link_id uuid not null references links (id) on delete cascade,
  clicked_at timestamptz not null
);
create index idx_link_clicks_link_id on link_clicks (link_id);