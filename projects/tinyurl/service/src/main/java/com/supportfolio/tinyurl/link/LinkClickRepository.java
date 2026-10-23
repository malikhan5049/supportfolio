package com.supportfolio.tinyurl.link;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LinkClickRepository extends JpaRepository<LinkClickEntity, UUID> {

  long countByLink(LinkEntity link);
}
