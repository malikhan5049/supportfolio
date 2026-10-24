package com.supportfolio.tinyurl.link;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** The only write/read path for {@code links}: one repository, own database, no shared schema. */
public interface LinkRepository extends JpaRepository<LinkEntity, UUID> {

  Optional<LinkEntity> findBySlug(String slug);

  boolean existsBySlug(String slug);

  /**
   * Public browse rows: link fields plus a left-join click count (zero-click links appear), newest
   * first. Never selects {@code createdBy} — creator identity never leaves the database for a
   * public endpoint.
   */
  @Query(
      """
      select l.slug as slug,
             l.targetUrl as targetUrl,
             l.createdAt as createdAt,
             count(c.id) as clickCount
      from LinkEntity l
      left join LinkClickEntity c on c.link.id = l.id
      group by l.id, l.slug, l.targetUrl, l.createdAt
      order by l.createdAt desc, l.id desc
      """)
  List<LinkSummary> findAllWithClickCounts();
}
