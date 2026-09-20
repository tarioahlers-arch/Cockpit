# HelferHand API-Contract

Backend: Node.js + Express + Prisma (SQLite) + Socket.io. Base URL in Entwicklung: `http://localhost:4000`.
Alle Antworten sind JSON. Alle Preise sind **Cent-Integer** in EUR (z.B. `6000` = 60,00 €).
Fehler: `{ "message": string, "details"?: unknown }` mit passendem HTTP-Status (400/401/403/404/409/500).

Auth: `Authorization: Bearer <JWT>` Header, Token kommt von `/api/auth/login` oder `/api/auth/register`.

## Enums (als String-Felder, kein natives DB-Enum)
- TaskStatus: `POSTED | ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED`
- ApplicationStatus / InvitationStatus: `PENDING | ACCEPTED | DECLINED`
- PaymentStatus: `PENDING | PAID | RELEASED | REFUNDED`
- SupportStatus: `OPEN | IN_PROGRESS | CLOSED`

## Auth
- `POST /api/auth/register` `{email,password,firstName,lastName,phone?,city?}` → `201 {token,user,devVerificationToken}` (devVerificationToken nur fuer Test-/Dev-Zwecke, da kein echter Mailversand)
- `POST /api/auth/verify-email` `{token}` → `{user}`
- `POST /api/auth/login` `{email,password}` → `{token,user}`
- `GET /api/auth/me` (auth) → `{user}`

`user` shape: `{id,email,firstName,lastName,phone,city,avatarUrl,bio,hourlyRate,radiusKm,emailVerified,isTaskerOnboarded,isAdmin,isBlocked,ratingAvg,ratingCount,createdAt,updatedAt}`

## Users
- `PATCH /api/users/me` (auth) `{firstName?,lastName?,phone?,city?,bio?,avatarUrl?}` → `{user}`
- `POST /api/users/me/tasker-onboarding` (auth) `{hourlyRate,radiusKm,categoryIds[],bio?}` → `{user}` (aktiviert Helfer-Modus)
- `POST /api/users/me/stripe-connect` (auth) → `{user,connected:true}` (simulierter Stripe-Connect-Onboarding im Test-Modus)
- `GET /api/users/:id` → `{user}` (public profile: id,firstName,lastName,avatarUrl,bio,city,hourlyRate,isTaskerOnboarded,ratingAvg,ratingCount,createdAt,skills[])
- `GET /api/users/:id/reviews` → `{reviews:[{id,rating,comment,isAnonymous,createdAt,reviewer:{...}|null,task:{id,title}}]}`

## Categories
- `GET /api/categories` → `{categories:[{id,name,icon}]}` (deutsche Kategorien, z.B. "Umzug & Transport", "Möbelmontage", "Reinigung", "Gartenarbeit", "Renovierung & Handwerk", "IT- & Technik-Hilfe", "Einkaufen & Botengänge", "Elektroinstallation", "Sonstiges")

## Tasks
- `POST /api/tasks` (auth) `{title,description,categoryId,city,address?,budgetCents,scheduledAt?}` → `201 {task}`
- `GET /api/tasks?categoryId=&city=&status=&q=&minBudget=&maxBudget=&page=&pageSize=` → `{tasks,total,page,pageSize}` (status default `POSTED`)
- `GET /api/tasks/mine?type=posted|in_progress|invites|applications|completed` (auth) → je nach type: `{tasks}` oder `{invitations}` oder `{applications}`
- `GET /api/tasks/:id` → `{task}` (inkl. `applications[]`, `invitations[]`, `category`, `poster`, `assignedTasker`)
- `PATCH /api/tasks/:id` (auth, nur poster) → `{task}`
- `POST /api/tasks/:id/apply` (auth) `{message?,proposedCents?}` → `201 {application}`
- `POST /api/tasks/:id/applications/:appId/accept` (auth, nur poster) → `{task}` (setzt status=ASSIGNED, erstellt Conversation)
- `POST /api/tasks/:id/invite` (auth, nur poster) `{taskerId}` → `201 {invitation}`
- `POST /api/tasks/:id/invitations/:invId/respond` (auth, nur eingeladener Tasker) `{accept:boolean}` → `{status}`
- `POST /api/tasks/:id/start` (auth, poster oder tasker) → `{task}` (ASSIGNED→IN_PROGRESS)
- `POST /api/tasks/:id/complete` (auth, nur poster) → `{task}` (→COMPLETED)
- `POST /api/tasks/:id/cancel` (auth, nur poster) → `{task}` (→CANCELLED)

`task` shape: `{id,title,description,categoryId,category,city,address,budgetCents,currency,status,posterId,poster,assignedTaskerId,assignedTasker,scheduledAt,createdAt,updatedAt,_count:{applications}}`

## Chat (REST + WebSocket)
- `GET /api/conversations` (auth) → `{conversations:[{id,taskId,task:{id,title,status},customer,tasker,messages:[lastMessage]}]}`
- `GET /api/conversations/:id/messages` (auth) → `{messages:[{id,senderId,sender,text,attachmentUrl,createdAt,readAt}]}`
- `POST /api/conversations/:id/messages` (auth) `{text?,attachmentUrl?}` → `201 {message}`

WebSocket (Socket.io) at server root, auth via `socket.handshake.auth.token = <JWT>`:
- emit `conversation:join` (conversationId) / `conversation:leave` (conversationId)
- emit `message:send` `{conversationId,text?,attachmentUrl?}` with ack `{message}` or `{error}`
- emit `typing` `{conversationId}`
- listen `message:new` (message object, broadcast to conversation room)
- listen `typing` `{userId}`
- listen `notification` (Notification object, sent to `user:<id>` room whenever one is created)

## Reviews
- `POST /api/tasks/:id/review` (auth, nur Beteiligte, nur wenn task COMPLETED) `{rating:1-5,comment?,isAnonymous?}` → `201 {review}`

## Payments (Stripe Test-Mode — funktioniert auch ohne echte Stripe-Keys via internem Stub)
- `POST /api/payments/tasks/:id/create-intent` (auth, nur poster, task muss ASSIGNED/IN_PROGRESS/COMPLETED sein) → `201 {payment,clientSecret,testMode:boolean}`
- `POST /api/payments/:id/confirm` (auth, nur poster) → `{payment}` (simuliert erfolgreiche Zahlung, da kein echtes Stripe-Webhook im Test-Modus)
- `POST /api/payments/connect/onboard` (auth) → `{connected:true,testMode}`
- `POST /api/payments/payout` (auth, nur assignedTasker) `{taskId}` → `{payment,payoutCents}` (Auszahlung abzueglich Plattformgebuehr, Standard 15%)

## Notifications
- `GET /api/notifications` (auth) → `{notifications,unreadCount}`
- `PATCH /api/notifications/:id/read` (auth) → `{notification}`
- `POST /api/notifications/read-all` (auth) → `{ok:true}`

## Support & Reports
- `POST /api/support` (auth) `{subject,message}` → `201 {ticket}`
- `GET /api/support/mine` (auth) → `{tickets}`
- `POST /api/reports` (auth) `{reportedUserId,reason}` → `201 {report}`

## Uploads (Chat-Anhänge, Avatare)
- `POST /api/uploads` (auth, multipart/form-data, field `file`, max 10MB) → `201 {url,filename}` — `url` ist relativ (`/uploads/xyz.png`), vom Backend unter `/uploads/*` statisch ausgeliefert.

## Admin (auth, nur isAdmin=true)
- `GET /api/admin/stats` → `{totalJobs,completedTasks,tasksInProgress,totalUsers,openTickets}`
- `GET /api/admin/users?q=` → `{users}`
- `PATCH /api/admin/users/:id/block` `{isBlocked:boolean}` → `{user}`
- `GET /api/admin/support-tickets` → `{tickets}`
- `PATCH /api/admin/support-tickets/:id` `{status}` → `{ticket}`
- `GET /api/admin/reports` → `{reports}`
- `GET /api/admin/tasks?status=` → `{tasks}`

## Demo-Zugänge (nach `npm run prisma:seed`, Passwort für alle: `Passwort123!`)
- Admin: `admin@helferhand.de`
- Kunde: `kunde@helferhand.de`
- Helfer: `helfer1@helferhand.de` (Berlin, Möbelmontage/Renovierung/Elektro)
- Helfer: `helfer2@helferhand.de` (München, Umzug/Reinigung/Garten)

## Deutschland-Lokalisierung
- Alle UI-Texte auf Deutsch, Währung EUR (Format `12,00 €`), Städte: Berlin, Hamburg, München, Köln, Frankfurt am Main, Stuttgart, Düsseldorf, Leipzig.
- App-Name: **HelferHand**. Markenfarbe: Grün/Teal (`#0F9D6C` als Primary empfohlen), TaskRabbit-inspiriertes, freundliches, aufgeräumtes UI.
- Footer/Legal-Seiten sollten Platzhalter für Impressum & Datenschutz (GDPR) enthalten (Route reicht, Inhalt kann Platzhalter sein).
