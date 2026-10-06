# Novedades

<!-- generado desde Git con Conventional Commits; no editar a mano -->

## 2026-10-06 — v0.1.104

### Correcciones

- Adjust BrandMark SVG size for better rendering

## 2026-10-06 — v0.1.103

### Nuevas funciones

- Add fallback icon for unsupported social platforms

## 2026-10-06 — v0.1.102

### Nuevas funciones

- Add warning for missing call notes or outcome in interactions
- Enhance proposal overview with attachment handling
- Add detailed proposal narrative and maintenance options
- Add next questions and validation status to Mom Test checklist

## 2026-10-05 — v0.1.101

### Nuevas funciones

- Add alias and company fields to lead details and actions

## 2026-10-05 — v0.1.100

### Nuevas funciones

- Add proposal details and external payment tracking to invoices

## 2026-10-05 — v0.1.99

### Nuevas funciones

- Change default finance range to quarter and update tests

## 2026-10-05 — v0.1.98

### Nuevas funciones

- Allow panel controls to render without card frame

## 2026-10-05 — v0.1.96

### Nuevas funciones

- Add delete danger zone for lead management

## 2026-10-05 — v0.1.95

### Nuevas funciones

- Add download option to signed URL generation

## 2026-10-05 — v0.1.94

### Nuevas funciones

- Add document download and preview functionality

## 2026-10-04 — v0.1.88

### Nuevas funciones

- Add sharing functionality for proposals with title
- Add mobile tab bar and update layout for better UX

## 2026-10-04 — v0.1.87

### Nuevas funciones

- Add public paths for PWA metadata and service worker

## 2026-10-04 — v0.1.86

### Nuevas funciones

- Add price breakdown component and update pricing display
- Add price visibility control and permissions for proposals
- Add role-based permissions and access control logic

## 2026-10-04 — v0.1.85

### Nuevas funciones

- Add electronic signature confirmation to proposal acceptance

## 2026-10-02 — v0.1.83

### Correcciones

- Isolate PDF initialization from internal document details

## 2026-10-01 — v0.1.82

### Mejoras

- Reducir trabajo repetido en servidor y portales (#4)

## 2026-10-01 — v0.1.81

### Mejoras

- Parallelize proposal page queries and track views after response

## 2026-10-01 — v0.1.80

### Correcciones

- Make the right-hand cards sticky on scroll

## 2026-10-01 — v0.1.79

### Correcciones

- Add top spacing so the response card does not touch the header

## 2026-10-01 — v0.1.78

### Correcciones

- Unblock Vercel build and stop language switch overlapping header badge

## 2026-10-01 — v0.1.76

### Nuevas funciones

- Complete first touch reminders when a lead is contacted

## 2026-10-01 — v0.1.75

### Nuevas funciones

- Add quarterly scope selection and update CSV export functionality

## 2026-10-01 — v0.1.73

### Correcciones

- Add accessible labels, button type and icon title

## 2026-10-01 — v0.1.69

### Nuevas funciones

- Generate backoffice changelog from git history

## 2026-09-23 — v0.1.28

### Correcciones

- Accept absent Meta attribution on landing leads

## 2026-09-23 — v0.1.26

### Correcciones

- Keep landing CORS domains canonical

## 2026-09-23 — v0.1.25

### Correcciones

- Preserve Google Ads attribution on landing leads

## 2026-09-16 — v0.1.3

### Nuevas funciones

- Refactor Drawer components to use Sheet and update related usages
- Refactor Drawer components to use Sheet and update related usages
- Implement DrawerQuickActions component and add tests for its functionality
- Add tests for MaintenanceOfferEditor and ProposalEditor components; implement migration for MCP proposal item access
- Enhance proposal and project relationships with new constraints and validations
- Implement CSV export for quarterly invoices and update related components
- Add meeting duration feature and update calendar event creation logic
- Update invoice types and add new SQL migrations for invoice number handling
- Update '@doscientos/ui' dependency to use local file reference
- Refactor scheduled post editing functionality to include caption and scheduled date updates
- Update cron schedule for social post publishing to every 10 minutes
- Implement scheduled post publishing functionality and add cron job for automation
- Refactor UI component imports to '@doscientos/ui' for consistency and add functionality to update scheduled post media
- Enhance logging in syncMetaAction for better error tracking and refactor managedFilterKeys to use useMemo for performance
- Refactor Popover component imports and usage for consistency across the application
- Update Checkbox component props to use isSelected and onChange for consistency
- Refactor imports to unify UI component exports from '@doscientos/ui'
- Streamline query formatting in lead-related functions for improved readability
- Reorder imports in package-adapters test file for consistency
- Enhance lead detail handling with optional company research availability
- Remove aria-busy attribute check from submit button test
- Add extractMetaLeads function and related tests for lead action handling
- Refactor ButtonGroup imports to use centralized component and remove deprecated files
- Update imports to use centralized Separator component in Field and Item
- Remove separator component and update imports in package adapters
- Enhance lead interaction components and improve error handling in marketing sync
- Enhance lead interaction components and improve error handling in marketing sync
- Add DialogRoot export to enhance dialog component functionality
- Add TooltipContent export to enhance tooltip functionality
- Enhance invoice and proposal payment options with company details
- Replace emailAppUrl with externalAppUrl for consistent URL handling across various actions
- Implement emailAppUrl utility to standardize email links and update usages across the application
- Implement emailAppUrl utility to standardize email links and update usages across the application
- Refactor MemberProfilePopover to use Button component and streamline Popover structure
- Refactor MemberProfilePopover to use Button component and streamline Popover structure
- Refactor MemberProfilePopover to use updated Popover component and improve structure
- Refactor MemberProfilePopover to use PopoverTrigger directly and update placement
- Update @doscientos/ui dependency to version 0.1.23 and refactor imports in UI components
- Reorganize exports in Alert and Badge components for improved readability
- Update Accordion component usage to allow multiple expanded items in Invoice and JourneyCard
- Consolidate exports in Accordion, Alert, Badge, and Tooltip components from shared UI library
- Simplify local UI aliases handling in next.config.ts and update Checkbox component documentation
- Refactor Checkbox component to use shared UI library and update props handling
- Update Switch component for accessibility and refactor related code
- Update pnpm-lock.yaml to reflect new package versions and peer dependencies
- Enhance local UI development setup by adding restore functionality and updating build scripts
- Add local React aliases for Turbopack configuration and deduplicate React dependencies in Vitest
- Integrate ButtonGroup components into package adapters tests for accessibility
- Add Separator component and corresponding tests for accessibility
- Update QWhatsAppDialog and WhatsAppComposer tests for improved interaction handling
- Add aiEnabled prop to lead components for AI integration
- Implement invoice extraction feature with AI and rules-based suggestions
- Update Meta marketing integration to include direct destination URL and adjust object URL handling
- Enhance attachment section with camera input for mobile attachments
- Implement clipboard paste functionality and enhance lead creation form
- Enhance startup splash handling and defer call reminders for improved user experience
- Add client-specific fields for tasks including titles and summaries
- Add client-specific fields for tasks including titles and summaries
- Add client-specific fields and functions for project task management
- Enhance task details in ProjectPortalPage to include client-specific titles and summaries
- Enhance web project types and add client visibility
- Update terminology to use 'workspace' instead of 'repository' in comments and tests for clarity
- Add workspace paths management feature with validation and migration support
- Remove unnecessary newline in actions.ts and project-portal.test.ts for cleaner code
- Reorder imports in actions.ts for consistency; add newline in project-portal migrations and tests
- Improve formatting and structure in ProjectPortalPage and ProjectRequestForm components; add tests for project portal migrations and request input validation
- Implement ProjectPortalPage with task and request management features
- Update branding assets and enhance LogoMark component for theme support
- Add WhatsApp follow-up composer
- Update branding assets and enhance LogoMark component for theme support
- Enhance LeadInteractionDetails component with email content display and reply functionality
- Add reply interaction handling to email composer and lead interaction details
- Add LeadInteractionDetails component to display email interaction details
- Enhance task management and email confirmation features
- Implement AI draft generation in EmailComposer with user instructions
- Implement global recovery chaining and enhance invoice QR synchronization
- Add invoice concepts handling and operational health checks for Verifactu
- Enhance invoice handling with additional client and fiscal validation properties
- Enhance invoice handling with additional client and fiscal validation properties
- Enhance invoice handling with regularization support and UI improvements
- Update QR code handling in invoice pages and improve responsive design in layout components
- Implement AEAT regularization handling in invoice actions and UI components
- Update Sidebar and NotificationsBell components to use ghost variant and border-0 class
- Enhance UserMenu component to support avatar-only display mode
- Update invoice action policy to include regularization for AEAT-rejected invoices
- Add migration to enforce uniqueness in verifactu_ledger for regularization process
- Add migration to resolve ledger_id ambiguity in claim_due_verifactu_outboxes function
- Add migration to fix ledger_id ambiguity in regularization process
- Add taxpayer identity fields for synthetic AEAT diagnostics and update related configurations
- Update navigation components and improve layout; add @phosphor-icons/react dependency
- Update navigation components and improve layout; add @phosphor-icons/react dependency
- Update navigation components and improve layout; add @phosphor-icons/react dependency
- Improve layout and styling for invoice and proposal pages
- Update @doscientos/ui dependency to version 0.1.7 and remove unused @phosphor-icons/react dependency
- Implement IconButton component with improved props handling and accessibility
- Implement IconButton component with improved props handling and accessibility
- Enhance invoice action components with improved layout and passkey authentication
- Implement MFA verification for invoice regularization and status changes
- Enhance RegularizeAeatButton with confirmation dialog and improved feedback handling
- Implement IconButton component for consistent icon actions and update usages across the application
- Add regularization functionality for AEAT invoices and implement recovery button
- Implement MFA challenge dialog and enhance invoice action error handling
- Add payment recording functionality to invoices with payment method support
- Refactor Badge component placement for verifactuMode in MobileNav and Sidebar
- Refactor VeriFactu configuration for improved environment handling and diagnostics
- Enhance sidebar with settings link and update user menu to conditionally show settings
- Add createProposalDraftInvoices function to generate invoice drafts for accepted proposals
- Remove duplicate imports and clean up invoice page code
- Lazy load QR code generation to improve page performance
- Update ListControls presentation and adjust padding for search icon
- Enhance navigation components with new features and tests
- Implement responsive navigation tree and refactor sidebar layout
- Consolidate proposal actions into a single dropdown menu and remove duplicate component
- Refactor createVerifactuClient to load dynamically and update related usages
- Import Button component in ProposalDetailError and update import statement in ProposalOverview
- Update error handling in proposal editor and tests, enhance error messages
- Add mock for Select component in proposal editor tests
- Add error handling component for proposal detail page
- Update proposal detail page to manage team members and enhance editing functionality
- Enhance proposal editor with team member management and update UI components
- Implement payment plan functionality for proposals and invoices
- Implement structured payment plans for proposals and invoices
- Add tests for ProposalActions component to verify proposal acceptance functionality
- Update @doscientos/ui and @doscientos/verifactu dependencies to specific versions in package.json and pnpm-lock.yaml
- Implement Verifactu issue handling with dialog and button components
- Add @doscientos/ui dependency as a linked module in package.json and pnpm-lock.yaml
- Remove unused @doscientos/ui dependency from package.json and pnpm-lock.yaml
- Update error handling in VaultClient and adjust secure cookie settings in grantVaultUnlock
- Add verifactuWarnings function and display AEAT warnings in InvoiceDetailPage
- Add verifactuWarnings function and display AEAT warnings in InvoiceDetailPage
- Add verifactuWarnings function and display AEAT warnings in InvoiceDetailPage
- Reorganize imports in invoice actions and progress dialog for consistency
- Reorganize imports in invoice actions and progress dialog for consistency
- Refactor InvoiceIssuanceProgressDialog and related tests for improved readability and structure
- Add unit tests for InvoiceIssuanceProgressDialog to verify fiscal step display and delivery status
- Enhance MfaTotpCard to include authenticator assurance level handling and improve enrollment verification
- Implement invoice issuance progress dialog and enhance status handling
- Refactor MFA TOTP card logic and add unit tests; enhance security settings with SQL migration
- Enhance security settings with MFA and passkey management components
- Implement VERI*FACTU diagnostic gate and related functionality for invoice processing
- Implement password login endpoint with rate limiting and CAPTCHA support
- Enhance VERI*FACTU invoice processing with rectification support and compliance documentation
- Reorganize imports in invoice handling and PDF document generation for clarity
- Refactor WhatsApp follow-up dialog to include email option and improve messaging
- Update test to reflect verifactu status change from accepted to pending
- Update invoice handling to include verifactu status checks and QR code generation logic
- Add email preview functionality for proposals with loading state and validation
- Improve call outcome display and remove unused note update functionality
- Enhance call interaction details with editing capabilities and validation
- Add recommended plan functionality to maintenance offer
- Add call date functionality and per-module upfront payment option
- Implement next action handling for leads with scheduled meetings
- Implement grouping of resend interactions and enhance interaction details in lead timeline
- Enhance lead management with scheduled meetings and reminders
- Add schema reload notification for proposal messages table
- Reorganize imports in ListControls and ListPage for improved readability
- Add status filter and integrate into ListControls component
- Reorganize imports in leads kanban for improved readability
- Add drag-and-drop functionality and necessary imports for leads kanban
- Enhance leads kanban and list controls with avatar support and meeting handling
- Enhance leads kanban functionality with drag-and-drop support and status updates
- Add optimistic concurrency control functions and triggers for proposals and invoices
- Add backup database configuration options and enhance backup actions UI
- Add lead next action task item component with completion and follow-up options
- Add action type classification for lead reminders and update related components
- Implement daily responsibilities notification system and related tests
- Add support for CRM follow-ups endpoint in proxy configuration
- Enhance maintenance options styling and layout in PDF document
- Implement manual save functionality in ProposalEditor and add presentation link in PortalProposalPage
- Add maintenance options to proposal with selection functionality and update PDF generation
- Implement startup splash logic with session storage handling and add tests
- Enhance MaintenanceListTextarea to support multiline edits and bullet list imports
- Add error handling for invalid JSON responses in runAIObject and implement tests
- Add maintenance options and related fields to proposals
- Add ccAdmins functionality to sendEmailToLead and related components
- Add schema reload notification for proposal messages table
- Add proposal message functionality
- Enhance maintenance offer functionality with exclusions and improve proposal handling
- Add tests for proposal maintenance offer functionality
- Integrate maintenance plan handling in proposal PDF generation
- Add maintenance options integration in proposal page and actions
- Integrate maintenance options in proposal detail and editor components
- Add ProposalMaintenanceOptions and MaintenanceOfferEditor components for managing maintenance plans
- Add maintenance options and update proposal handling in database and tests
- Implement proposal validation formatting and enhance error handling in updateProposal function
- Enhance proposal draft generation with scope modules, deliverables, acceptance criteria, payment terms, and change management terms
- Refactor proposal payment components and improve import organization
- Implement dynamic initial payment calculation and enhance proposal payment handling
- Refactor proposal components and enhance PDF generation with improved formatting and structure
- Improve formatting and readability in ProposalEditor component
- Enhance proposal PDF generation with scope modules, deliverables, acceptance criteria, payment terms, and change management sections
- Add scope modules and delivery details to proposal, including payment terms and change management sections
- Enhance proposal editor with scope modules and detailed deliverables, acceptance criteria, payment terms, and change management sections
- Add scope modules editor and related schema updates for proposal management
- Implement Gmail synchronization settings with mailbox management and UI integration
- Exclude drafts from Gmail message search for leads
- Enhance Gmail synchronization with improved message handling and add tests for listLeadGmailMessages
- Implement Gmail synchronization for leads, including UI button and backend logic
- Add tests for invoice request functionality and notification dispatch
- Implement invoice request functionality and enhance notifications for invoice-related actions
- Enhance proposal management with follow-up reminders and lead status updates
- Implement PDF text extraction and indexing for internal documents
- Add PDF download functionality for proposals and implement PDF rendering logic
- Update billing address field to billing_address_street across proposal and client data handling
- Add error handling for proposal data retrieval in Deck and PortalProposal pages
- Improve error handling for proposal data retrieval in Deck and Portal pages
- Enhance problem-solution editor and schemas for improved validation and descriptions
- Enhance proxy logic for public portal and deck paths, including session refresh handling
- Implement nextMove function for lead status handling and add tests for Lead360Timeline component
- Update rectification tests and enhance logging for invoice creation
- Integrate RPC function into rectification tests and update invoice actions
- Refactor invoice creation and rectification logic to use RPC functions
- Refactor lead conversion and proposal item update logic with new RPC functions
- Refactor proposal item handling and totals calculation
- Enhance extract-tasks dialog and client update panel with improved imports and formatting
- Update extract-tasks functionality to allow empty task results and improve lead briefing format
- Enhance call digest dialog with improved AI integration and task management
- Enhance ClientUpdatePanel with detailed project update display and improved state management
- Enhance client update generation with improved schema validation and refined system prompt
- Add ProposalFollowUpAssistant component for actionable proposal follow-ups
- Implement AI call copilot and next best action endpoints with task creation support
- Add AI draft generation tests for proposal endpoint, including validation and response checks
- Implement AI draft generation for proposals, enhance proposal forms and editor with AI context support
- Add VAULT_ENCRYPTION_KEY support and validation schema, update env example and tests
- Refactor Meta CAPI integration to use qualified lead stage and update related functions
- Implement cross-module dashboard pulse and enhance lead and subscription details
- Update rate limit mock to use distributedRateLimit and enhance test input structure
- Implement distributed rate limiting and enhance diagnostics input validation
- Add payment revert functionality and enhance AEAT feedback messages
- Implement Verifactu durable ledger and transactional outbox with delivery state management
- Simplify className logic for signal buttons in Mom Test dialog
- Implement Mom Test accessibility feature with automated and manual signals
- Optimize lead ingestion process by refactoring conversion event handling
- Enhance marketing metrics with outbound clicks and landing page views tracking
- Implement token-gated access for MCP with RLS policies and cleanup obsolete authentication methods
- Add lead analytics page and related components
- Add PasskeyStatusCard component and integrate passkey checks in various pages
- Add VerifiedWebProjectForm component for creating and editing web projects
- Enhance ConversionEventsPage with improved event icons and layout adjustments
- Enhance LeadConversionJourneySection with formatted journey events display
- Implement recurring subscription invoice generation with cron job and database function
- Implement lead briefing functionality and enhance lead detail retrieval
- Refactor brand kit API to include token retrieval and improve error handling
- Add guides management with CRUD operations and public API integration
- Enhance diagnostics report generation with landing URL and improved CORS handling
- Add MEETING_PROJECT_STATUSES for project state selection in lead meetings
- Add LeadDetailError component to handle errors in lead detail page
- Refactor lead detail page to use async sections for conversion journey, diagnostics, attachments, and quick actions
- Add SalesControlWidget for team coordination and enhance lead notifications with call and WhatsApp actions
- Automate sales follow-up and unify action queue
- Implement call reminder functionality and WhatsApp follow-up feature
- Add language selection for email drafting and update API to support language parameter
- Add loading skeleton components for brand, calendar, subscriptions, and vault
- Integrate Meta CAPI notifications for invoice payments and lead status updates
- Integrate Meta CAPI for server-side lead tracking and enhance deduplication logic
- Enhance calendar components with improved event handling and UI updates - Refactored CalendarCreateDialog to handle contacts instead of leads - Added deleteCalendarEvent function to manage Google Calendar events - Introduced LayersDropdown for filtering calendar event types - Updated EntityCombobox to support custom item rendering and ghost text - Enhanced CalendarGrid with new WeekTimeGrid for better time management - Improved CalendarHeader with dropdown for layer selection
- Enhance phone actions and notifications with improved URL handling and notification click behavior
- Add onlyBuiltDependencies configuration for pnpm to optimize package management
- Introduce new hooks and utilities for enhanced form handling and UI skeletons
- Add new UI components including Input, Item, Kbd, Label, Markdown, Menubar, PasswordStrength, Popover, Select, Separator, Skeleton, SubmitButton, Switch, Table, and Textarea
- Scaffold backoffice MVP - Next 16 + Supabase + Verifactu + Resend

### Correcciones

- Update cron schedule for social post publishing from every 15 minutes to every 45 minutes
- Update @doscientos/ui dependency from local file to version 0.1.29
- Adjust z-index for PopoverContent in NotificationsBell component
- Correct expected output in draft email test case
- Update mock implementation for updateLeadMomTestSignal to return a resolved promise feat: add actions test file with task completion and movement tests
- Remove unnecessary newlines in export statements for consistency
- Remove unnecessary newlines in export statements for consistency
- Simplify status assignment in getCertificateHealth function
- Reorder import statement for consistency in lead follow-up summary tests
- Reorder import statement for consistency in lead follow-up summary tests
- Update proposal status display and refactor header layout
- Trim whitespace from context markdown and update related tests to omit empty context slide
- Update test to ensure button click is properly handled and add missing properties in verifactu delivery tests
- Defer verifactu diagnostics loading
- Defer verifactu runtime loading
- Reorder import statement and correct error message formatting in crypto.ts
- Reorder import statement and clarify comments in next.config.ts
- Clean up formatting and improve readability in ListControls and ListPage components
- Clean up formatting and improve readability in ListControls component
- Reorder imports for consistency in ProposalMessageThread component
- Remove unused import and update event type in ProposalMessageThread component
- Remove unnecessary blank line in PortalProposalPage component
- Update service worker registration error handling in PwaRegister component
- Update error handling to retry on structured output errors in normalizeAIError
- Ensure draft state updates correctly on textarea change in MaintenanceListTextarea
- Ensure proper policy management for proposal messages table
- Reorder import statement for useState in GmailSyncForm component
- Ensure consistent formatting in error message for VAULT_ENCRYPTION_KEY requirement
- Qualify verifactu cancellation outbox claim
- Qualify verifactu retry outbox columns
- Ensure verifactu error status across environments
- Correct verifactu outbox completion query
- Align verifactu migration with invoice schema
- Enhance logLeadCall to update lead status and log interactions on call outcome
- Add scheduleLeadMeeting action and related tests for Google Calendar integration
- Refactor WhatsApp message construction for clarity and maintainability
- Reorder imports for consistency in phone actions component
- Reorder imports and refactor date formatting in lead AI panel and lead detail page
- Format code for better readability in lead AI panel and queries
- Reorder import statements in lead AI panel and update lead detail query for attachments
- Reorder import statements and update comment in brand kit route
- Reorder import statements in brand kit route
- Reorder import statements in LeadDetailError component
- Remove OpenAI API key section from environment example
- Reorder imports for consistency and improved readability across multiple components
- Remove unnecessary whitespace in promise catch blocks for consistency
- Add biome-ignore comments for accessibility linting in various components
- Add optional chaining to focusNextAfter function for safer DOM access
- Align ClientRowActions type with structured billing address fields
- Update revalidateTag calls for Next.js 16 two-arg signature

