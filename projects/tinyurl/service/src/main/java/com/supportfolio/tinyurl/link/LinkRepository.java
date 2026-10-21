package com.supportfolio.tinyurl.link;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** The only write/read path for {@code links}: one repository, own database, no shared schema. */
public interface LinkRepository extends JpaRepository<LinkEntity, UUID> {

  Optional<LinkEntity> findBySlug(String slug);

  boolean existsBySlug(String slug);
}
