package com.supportfolio.tinyurl.link;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "link_clicks")
public class LinkClickEntity {

  @Id private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "link_id", nullable = false)
  private LinkEntity link;

  @Column(name = "clicked_at", nullable = false)
  private Instant clickedAt;

  protected LinkClickEntity() {}

  public LinkClickEntity(UUID id, LinkEntity link, Instant clickedAt) {
    this.id = id;
    this.link = link;
    this.clickedAt = clickedAt;
  }

  public UUID getId() {
    return id;
  }

  public LinkEntity getLink() {
    return link;
  }

  public Instant getClickedAt() {
    return clickedAt;
  }
}
