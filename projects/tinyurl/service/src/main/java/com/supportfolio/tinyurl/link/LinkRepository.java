package com.supportfolio.tinyurl.link;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface LinkRepository extends JpaRepository<LinkEntity, UUID> {

  Optional<LinkEntity> findBySlug(String slug);

  boolean existsBySlug(String slug);

  @Query(
      """
      select l.slug as slug, l.targetUrl as targetUrl, l.createdAt as createdAt, count(c.id) as clickCount
      from LinkEntity l left join LinkClickEntity c on c.link = l
      group by l.id, l.slug, l.targetUrl, l.createdAt
      order by l.createdAt desc, l.id desc
      """)
  List<LinkSummary> findAllWithClickCounts();
}
