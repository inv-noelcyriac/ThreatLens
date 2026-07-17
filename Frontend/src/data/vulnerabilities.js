export const vulnerabilities = [
  {
    id: "CVE-2024-6387",
    ghsa: null,
    title: "OpenSSH: Race Condition RCE (regreSSHion)",
    severity: "CRITICAL",
    cvss: 8.1,
    remediation: "Upgrade openssh-server to 9.8p1+",
    ecosystem: "OS (Linux)",
    source: "NVD",
    date: "01 Jul 2024",
    status: "OPEN",
    published: "01 Jul 2024",
    lastUpdated: "15 Jul 2024",
    cvssVersion: "CVSS V3.1",
    description:
      "A race condition vulnerability in OpenSSH's server (sshd) in glibc-based Linux systems allows unauthenticated remote code execution as root. This is a regression of CVE-2006-5051, reintroduced in OpenSSH 8.5p1 and fixed in 9.8p1.",
    affectedComponents: [
      {
        component: "openssh-server",
        affectedVersions: "< 9.8p1",
        instance: "System Package",
        status: "VULNERABLE",
      },
    ],
    references: [
      {
        name: "NVD",
        url: "nvd.nist.gov/vuln/detail/CVE-2024-6387",
      },
      {
        name: "Qualys Blog",
        url: "www.qualys.com/2024/07/01/cve-2024-6387/regresshion.txt",
      },
    ],
  },
  {
    id: "GHSA-mh63-6h87-95cp",
    ghsa: "GHSA-mh63-6h87-95cp",
    title: "webpack-dev-server: Source Code Theft via Origin",
    severity: "LOW",
    cvss: 3.7,
    remediation: "Upgrade webpack-dev-server to 5.2.1+",
    ecosystem: "npm",
    source: "GitHub",
    date: "14 Jun 2024",
    status: "OPEN",
    published: "14 Jun 2024",
    lastUpdated: "20 Jun 2024",
    cvssVersion: "CVSS V3.1",
    description:
      "webpack-dev-server before 5.2.1 is vulnerable to source code theft. An attacker can access a victim's source code by exploiting the Origin header on WebSocket connections, allowing them to exfiltrate source maps and application source code.",
    affectedComponents: [
      {
        component: "webpack-dev-server",
        affectedVersions: "< 5.2.1",
        instance: "npm Package",
        status: "VULNERABLE",
      },
    ],
    references: [
      {
        name: "GitHub Advisory",
        url: "github.com/advisories/GHSA-mh63-6h87-95cp",
      },
    ],
  },
  {
    id: "CVE-2024-3094",
    ghsa: null,
    title: "xz-utils: Backdoor in liblzma",
    severity: "CRITICAL",
    cvss: 10.0,
    remediation: "Downgrade to xz-utils 5.4.6 or upgrade to 5.6.2+",
    ecosystem: "OS (Linux)",
    source: "NVD",
    date: "29 Mar 2024",
    status: "OPEN",
    published: "29 Mar 2024",
    lastUpdated: "01 Apr 2024",
    cvssVersion: "CVSS V3.1",
    description:
      "A malicious backdoor was discovered in liblzma part of the xz package, versions 5.6.0 and 5.6.1. The backdoor targets sshd via systemd integration allowing remote unauthenticated code execution on affected systems.",
    affectedComponents: [
      {
        component: "xz-utils",
        affectedVersions: "5.6.0 - 5.6.1",
        instance: "System Package",
        status: "VULNERABLE",
      },
    ],
    references: [
      {
        name: "NVD",
        url: "nvd.nist.gov/vuln/detail/CVE-2024-3094",
      },
      {
        name: "Openwall Announcement",
        url: "www.openwall.com/lists/oss-security/2024/03/29/4",
      },
    ],
  },
  {
    id: "GHSA-jjjh-jjxp-wpff",
    ghsa: "GHSA-jjjh-jjxp-wpff",
    title: "next.js: Cache Poisoning in Image Optimization",
    severity: "MEDIUM",
    cvss: 6.5,
    remediation: "Upgrade next to 14.1.1+",
    ecosystem: "npm",
    source: "GitHub",
    date: "14 Feb 2024",
    status: "OPEN",
    published: "14 Feb 2024",
    lastUpdated: "20 Feb 2024",
    cvssVersion: "CVSS V3.1",
    description:
      "Next.js before 14.1.1 is vulnerable to a cache poisoning attack in the image optimization endpoint. An attacker can craft requests to cache poisoned responses, potentially serving malicious content to other users.",
    affectedComponents: [
      {
        component: "next",
        affectedVersions: "< 14.1.1",
        instance: "npm Package",
        status: "VULNERABLE",
      },
    ],
    references: [
      {
        name: "GitHub Advisory",
        url: "github.com/advisories/GHSA-jjjh-jjxp-wpff",
      },
    ],
  },
  {
    id: "CVE-2024-21626",
    ghsa: null,
    title: "runc: Container Escape via File Descriptor Leak",
    severity: "HIGH",
    cvss: 8.6,
    remediation: "Upgrade runc to 1.1.12+",
    ecosystem: "Docker",
    source: "GitHub",
    date: "31 Jan 2024",
    status: "OPEN",
    published: "31 Jan 2024",
    lastUpdated: "05 Feb 2024",
    cvssVersion: "CVSS V3.1",
    description:
      "runc through 1.1.11 has an internal file descriptor leak that allows an attacker to fully break out of container isolation, effectively escaping the container and gaining root access to the host.",
    affectedComponents: [
      {
        component: "runc",
        affectedVersions: "< 1.1.12",
        instance: "Container Runtime",
        status: "VULNERABLE",
      },
    ],
    references: [
      {
        name: "NVD",
        url: "nvd.nist.gov/vuln/detail/CVE-2024-21626",
      },
      {
        name: "GitHub Advisory",
        url: "github.com/opencontainers/runc/security/advisories/GHSA-xr7r-f8xq-vfvv",
      },
    ],
  },
  {
    id: "GHSA-2c47-8vpg-fxpm",
    ghsa: "GHSA-2c47-8vpg-fxpm",
    title: "express: Open Redirect in res.redirect",
    severity: "MEDIUM",
    cvss: 5.4,
    remediation: "Upgrade express to 4.19.2+",
    ecosystem: "npm",
    source: "GitHub",
    date: "22 Jan 2024",
    status: "OPEN",
    published: "22 Jan 2024",
    lastUpdated: "28 Jan 2024",
    cvssVersion: "CVSS V3.1",
    description:
      "Express.js before 4.19.2 is vulnerable to open redirect attacks via the res.redirect() function. An attacker can craft URLs that bypass redirect validation, leading to phishing or credential theft.",
    affectedComponents: [
      {
        component: "express",
        affectedVersions: "< 4.19.2",
        instance: "npm Package",
        status: "VULNERABLE",
      },
    ],
    references: [
      {
        name: "GitHub Advisory",
        url: "github.com/advisories/GHSA-2c47-8vpg-fxpm",
      },
    ],
  },
  {
    id: "CVE-2023-44487",
    ghsa: null,
    title: "HTTP/2 Rapid Reset Attack (Flood DDoS)",
    severity: "HIGH",
    cvss: 7.5,
    remediation: "Patch your HTTP/2 server implementation",
    ecosystem: "Web",
    source: "NVD",
    date: "10 Oct 2023",
    status: "OPEN",
    published: "10 Oct 2023",
    lastUpdated: "18 Oct 2023",
    cvssVersion: "CVSS V3.1",
    description:
      "The HTTP/2 protocol allows a denial of service (server resource consumption) because request cancellation can reset many streams quickly. This issue is also known as Rapid Reset.",
    affectedComponents: [
      {
        component: "HTTP/2 Servers",
        affectedVersions: "Multiple implementations",
        instance: "Server",
        status: "VULNERABLE",
      },
    ],
    references: [
      {
        name: "NVD",
        url: "nvd.nist.gov/vuln/detail/CVE-2023-44487",
      },
    ],
  },
  {
    id: "CVE-2023-38408",
    ghsa: null,
    title: "OpenSSH: Remote Code Execution via ssh-agent",
    severity: "CRITICAL",
    cvss: 9.8,
    remediation: "Upgrade OpenSSH to 9.3p2+",
    ecosystem: "OS (Linux)",
    source: "NVD",
    date: "19 Jul 2023",
    status: "OPEN",
    published: "19 Jul 2023",
    lastUpdated: "25 Jul 2023",
    cvssVersion: "CVSS V3.1",
    description:
      "A remote code execution vulnerability in the PKCS#11 feature of OpenSSH's forwarded ssh-agent allows an attacker to load arbitrary PKCS#11 libraries from /usr/lib, potentially executing malicious code.",
    affectedComponents: [
      {
        component: "openssh",
        affectedVersions: "< 9.3p2",
        instance: "System Package",
        status: "VULNERABLE",
      },
    ],
    references: [
      {
        name: "NVD",
        url: "nvd.nist.gov/vuln/detail/CVE-2023-38408",
      },
    ],
  },
  {
    id: "GHSA-c2qf-rxjj-qqgw",
    ghsa: "GHSA-c2qf-rxjj-qqgw",
    title: "semver: Regular Expression DoS Vulnerability",
    severity: "MEDIUM",
    cvss: 5.3,
    remediation: "Upgrade semver to 6.3.1, 7.5.2, or 5.7.2+",
    ecosystem: "npm",
    source: "GitHub",
    date: "21 Jun 2023",
    status: "OPEN",
    published: "21 Jun 2023",
    lastUpdated: "28 Jun 2023",
    cvssVersion: "CVSS V3.1",
    description:
      "The semver package for Node.js is vulnerable to a Regular Expression Denial of Service (ReDoS) attack. An attacker can provide a specially crafted string that causes the semver package to hang, consuming excessive CPU resources.",
    affectedComponents: [
      {
        component: "semver",
        affectedVersions: "< 5.7.2, 6.x < 6.3.1, 7.x < 7.5.2",
        instance: "npm Package",
        status: "VULNERABLE",
      },
    ],
    references: [
      {
        name: "GitHub Advisory",
        url: "github.com/advisories/GHSA-c2qf-rxjj-qqgw",
      },
    ],
  },
  {
    id: "CVE-2022-0778",
    ghsa: null,
    title: "OpenSSL: Infinite Loop via Certificate Parsing",
    severity: "HIGH",
    cvss: 7.5,
    remediation: "Upgrade OpenSSL to 1.0.2zd, 1.1.1n, or 3.0.2+",
    ecosystem: "OS (Linux)",
    source: "NVD",
    date: "15 Mar 2022",
    status: "RESOLVED",
    published: "15 Mar 2022",
    lastUpdated: "20 Mar 2022",
    cvssVersion: "CVSS V3.1",
    description:
      "The BN_mod_sqrt() function of OpenSSL, which computes a modular square root, contains a bug that can cause it to loop forever for non-prime moduli. Internally this function is used when parsing certificates that contain elliptic curve public keys, so an attacker can cause a denial of service by providing a crafted certificate.",
    affectedComponents: [
      {
        component: "openssl",
        affectedVersions: "< 3.0.2",
        instance: "System Package",
        status: "PATCHED",
      },
    ],
    references: [
      {
        name: "NVD",
        url: "nvd.nist.gov/vuln/detail/CVE-2022-0778",
      },
      {
        name: "OpenSSL Advisory",
        url: "www.openssl.org/news/secadv/20220315.txt",
      },
    ],
  },
  {
    id: "GHSA-hrpp-h998-j3pp",
    ghsa: "GHSA-hrpp-h998-j3pp",
    title: "qs: Prototype Pollution via Parsing of Object Query Strings",
    severity: "HIGH",
    cvss: 8.1,
    remediation: "Upgrade qs to 6.10.3+",
    ecosystem: "npm",
    source: "GitHub",
    date: "22 Sep 2022",
    status: "OPEN",
    published: "22 Sep 2022",
    lastUpdated: "30 Sep 2022",
    cvssVersion: "CVSS V3.1",
    description:
      "qs is vulnerable to Prototype Pollution due to improper user-supplied key validation. A malicious user could inject properties onto Object.prototype, affecting all instances of the object.",
    affectedComponents: [
      {
        component: "qs",
        affectedVersions: "< 6.10.3",
        instance: "npm Package",
        status: "VULNERABLE",
      },
    ],
    references: [
      {
        name: "GitHub Advisory",
        url: "github.com/advisories/GHSA-hrpp-h998-j3pp",
      },
    ],
  },
  {
    id: "CVE-2021-44228",
    ghsa: null,
    title: "Log4Shell: Remote Code Execution in Log4j",
    severity: "CRITICAL",
    cvss: 10.0,
    remediation: "Upgrade log4j to 2.17.1+",
    ecosystem: "Maven",
    source: "NVD",
    date: "10 Dec 2021",
    status: "RESOLVED",
    published: "10 Dec 2021",
    lastUpdated: "20 Dec 2021",
    cvssVersion: "CVSS V3.1",
    description:
      "Apache Log4j2 2.0-beta9 through 2.15.0 (excluding 2.12.2, 2.12.3, and 2.3.1) JNDI features used in configuration, log messages, and parameters do not protect against attacker controlled LDAP and other JNDI related endpoints, allowing remote code execution.",
    affectedComponents: [
      {
        component: "log4j-core",
        affectedVersions: "2.0-beta9 - 2.15.0",
        instance: "Maven Artifact",
        status: "PATCHED",
      },
    ],
    references: [
      {
        name: "NVD",
        url: "nvd.nist.gov/vuln/detail/CVE-2021-44228",
      },
      {
        name: "Apache Advisory",
        url: "logging.apache.org/log4j/2.x/security.html",
      },
    ],
  },
];
