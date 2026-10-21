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

/**
 * One click on a short link. Exactly one row is inserted per successful {@code /go/{slug}} follow;
 * the shape (rows, not a counter) keeps richer analytics possible without a schema rewrite.
 */
@Entity
@Table(name = "link_clicks")
public class LinkClickEntity {

  @Id
  UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "link_id")
  LinkEntity link;

  @Column(name = "clicked_at", nullable = false)
  Instant clickedAt;

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
