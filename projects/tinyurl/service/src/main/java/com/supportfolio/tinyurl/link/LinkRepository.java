package com.supportfolio.tinyurl.link;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LinkRepository extends JpaRepository<LinkEntity, UUID> {

  Optional<LinkEntity> findBySlug(String slug);

  boolean existsBySlug(String slug);
}
