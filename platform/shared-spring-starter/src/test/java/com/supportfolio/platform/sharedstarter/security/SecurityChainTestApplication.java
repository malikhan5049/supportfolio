package com.supportfolio.platform.sharedstarter.security;

import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;

/**
 * Minimal bootable application for the starter's actuator-chain integration tests: full
 * auto-configuration (so actuator endpoints and the starter's own auto-configuration are live)
 * without pulling in the production services.
 */
@SpringBootConfiguration
@EnableAutoConfiguration
class SecurityChainTestApplication {}
