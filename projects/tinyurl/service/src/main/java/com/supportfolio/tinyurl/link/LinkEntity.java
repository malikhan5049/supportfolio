package com.supportfolio.tinyurl.link;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * A shortened link. The schema is owned by Flyway (V1__create_link_tables.sql); Hibernate only
 * validates ({@code ddl-auto=validate}). Clicks are separate rows with a database-level cascading
 * FK, so deleting a link never needs the association mapped here.
 */
@Entity
@Table(name = "links")
public class LinkEntity {

  @Id
  UUID id;

  @Column(length = 32, unique = true)
  String slug;

  @Column(name = "target_url", columnDefinition = "text", nullable = false)
  String targetUrl;

  @Column(name = "created_by", nullable = false)
  String createdBy;

  @Column(name = "created_at", nullable = false)
  Instant createdAt;

  protected LinkEntity() {}

  public LinkEntity(UUID id, String slug, String targetUrl, String createdBy, Instant createdAt) {
    this.id = id;
    this.slug = slug;
    this.targetUrl = targetUrl;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
  }

  public UUID getId() {
    return id;
  }

  public String getSlug() {
    return slug;
  }

  public String getTargetUrl() {
    return targetUrl;
  }

  public String getCreatedBy() {
    return createdBy;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
