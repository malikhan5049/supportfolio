package com.supportfolio.tinyurl.link;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "links")
public class LinkEntity {

  @Id private UUID id;

  @Column(length = 32, nullable = false, unique = true)
  private String slug;

  @Column(name = "target_url", columnDefinition = "text", nullable = false)
  private String targetUrl;

  @Column(name = "created_by", nullable = false)
  private String createdBy;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

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
