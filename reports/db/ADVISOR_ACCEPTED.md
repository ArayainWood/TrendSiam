# SECURITY ADVISOR ACCEPTED ITEMS

**Date:** October 20, 2025  
**Purpose:** Document security items accepted by design with mitigation strategies

---

## SECURITY DEFINER VIEWS (7 items)

These views are **intentionally configured as SECURITY DEFINER** to implement our Plan-B security model.

### Design Rationale

**Why SECURITY DEFINER is correct:**
1. Enforces read-only access pattern (anon cannot modify data)
2. Hides base table structure from external clients
3. Provides column-level filtering without exposing schema
4. Enables schema changes without breaking clients
5. Centralizes security policy at the view layer

**Why this is safer than alternatives:**
- Direct table grants would expose full schema
- Client-side filtering is bypassable
- RLS policies alone don't hide columns
- Views provide defense-in-depth

---

## ACCEPTED ITEMS

### A01: public.home_feed_v1 (Canonical View)
**Type:** Security Definer View  
**Owner:** postgres (service role)  
**Purpose:** Primary home feed data for frontend

**Security Controls:**
- ✅ Owner (postgres) has minimal privileges
- ✅ Only SELECT granted to anon/authenticated
- ✅ Column filtering (excludes internal fields)
- ✅ No INSERT/UPDATE/DELETE possible
- ✅ Search path locked to pg_catalog, public
- ✅ View is read-only by design

**Risk Level:** LOW  
**Mitigation:** Regular security audits, view owner review

---

### A02: public.public_v_home_news (Compatibility Alias)
**Type:** Security Definer View  
**Owner:** postgres  
**Purpose:** Backward compatibility alias for home_feed_v1

**Security Controls:**
- ✅ Same as home_feed_v1
- ✅ Maintained for smooth migrations
- ✅ Points to canonical view

**Risk Level:** LOW  
**Mitigation:** Deprecate once all clients use home_feed_v1

---

### A03: public.public_v_system_meta
**Type:** Security Definer View  
**Owner:** postgres  
**Purpose:** Expose safe system metadata to anon users

**Security Controls:**
- ✅ Filters to safe keys only (home_limit, top3_max, news_last_updated)
- ✅ No sensitive config exposed
- ✅ Read-only access

**Risk Level:** LOW  
**Mitigation:** Whitelist approach for exposed keys

---

### A04: public.public_v_ai_images_latest
**Type:** Security Definer View  
**Owner:** postgres  
**Purpose:** Provide Top-3 AI-generated images

**Security Controls:**
- ✅ Only AI-generated images (no user content)
- ✅ Limited to Top-3 items
- ✅ All images labeled "AI-generated"

**Risk Level:** LOW  
**Mitigation:** Content policy enforcement

---

### A05: public.public_v_weekly_stats
**Type:** Security Definer View  
**Owner:** postgres  
**Purpose:** Weekly report statistics

**Security Controls:**
- ✅ Aggregated data only
- ✅ No individual user data
- ✅ Read-only

**Risk Level:** LOW  
**Mitigation:** Regular data review

---

### A06: public.public_v_weekly_snapshots
**Type:** Security Definer View  
**Owner:** postgres  
**Purpose:** Weekly snapshot data for PDF generation

**Security Controls:**
- ✅ Snapshot-based (immutable)
- ✅ No real-time PII
- ✅ Used by Chromium PDF engine

**Risk Level:** LOW  
**Mitigation:** Snapshot retention policy

---

### A07: public.public_v_latest_snapshots
**Type:** Security Definer View  
**Owner:** postgres  
**Purpose:** Latest snapshot metadata

**Security Controls:**
- ✅ Metadata only (IDs, dates)
- ✅ No content exposure
- ✅ Read-only

**Risk Level:** LOW  
**Mitigation:** Minimal data exposure

---

## DEFENSE-IN-DEPTH STRATEGY

### Layer 1: Network
- Supabase-managed SSL/TLS
- Connection pooler

### Layer 2: Authentication
- Anon key for public access
- Service-role key for backend only (never exposed)

### Layer 3: Authorization (Our Focus)
- SECURITY DEFINER views (controlled access)
- No direct table grants to anon
- Column filtering at view layer
- RLS on base tables (double protection)

### Layer 4: Application
- Frontend validation
- Rate limiting
- Monitoring

---

## MONITORING & AUDIT

### Regular Reviews
- [ ] Quarterly: Review view definitions
- [ ] Quarterly: Audit grants and policies
- [ ] Annually: Full security assessment

### Automated Checks
- ✅ Schema guard: `/api/health-schema`
- ✅ View availability checks
- ✅ No direct table access tests

### Alerts
- Unexpected grants to anon
- View definition changes
- RLS policy changes

---

## SIGN-OFF

**Security Model:** Plan-B (Playbook 2.0)  
**Approach:** SECURITY DEFINER views + RLS  
**Risk Assessment:** LOW (with mitigations)  
**Approved By:** _______________ (Pending)  
**Date:** 2025-10-20

---

END OF ACCEPTED ITEMS DOCUMENT
