package com.supportfolio.tinyurl.link;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LinkClickRepository extends JpaRepository<LinkClickEntity, UUID> {

  @Query("select count(c) from LinkClickEntity c where c.link.id = :linkId")
  long countByLinkId(@Param("linkId") UUID linkId);
}
