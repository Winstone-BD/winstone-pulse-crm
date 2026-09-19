package com.winstone.connect.data

import org.json.JSONArray
import org.json.JSONObject

data class Lead(
    val id: String,
    val name: String,
    val phone: String,
    val company: String?,
    val status: String,
    val attempts: Int,
    val notes: String?,
    /** কাজের দিন (YYYY-MM-DD, ঢাকা সময়) — আজ, আগের দিন বা আগামী দিনের টাস্ক। */
    val workDate: String? = null,
    val workState: String? = null,
    val createdAt: String? = null,
    val lastCallAt: String? = null,
    val classifiedAt: String? = null,
)

data class CallRow(
    val id: String,
    val leadId: String?,
    val phone: String,
    val durationSeconds: Int,
    val direction: String,
    val syncStatus: String,
    val summary: String?,
    val sentiment: String?,
    val createdAt: String,
)

data class MessageRow(
    val id: String,
    val leadId: String?,
    val senderType: String,
    val content: String,
    val createdAt: String,
)

data class DeskData(
    val agentId: String,
    val agentName: String,
    val leads: List<Lead>,
    val calls: List<CallRow>,
    val messages: List<MessageRow>,
    /** Server-computed workday allocation; null until the phone syncs. */
    val allocation: Allocation? = null,
)

/**
 * The workday allocation numbers exactly as the server counted them.
 *
 * The app only displays these — it never works out a target, a pending count or
 * an excess of its own, and it never decides allocation from the device clock.
 * Offline the phone keeps showing the last synced numbers and commits nothing;
 * the next successful sync reconciles it with the server.
 */
data class Allocation(
    val workDate: String,
    val quota: Int,
    val pending: Int,
    val carriedOver: Int,
    val carriedFrom: String?,
    val newFromDatabase: Int,
    val receivedFromOthers: Int,
    val movedToOthers: Int,
    val completed: Int,
    val excess: Int,
    val gap: Int,
    val poolShortage: Int,
)

fun parseAllocation(body: org.json.JSONObject?): Allocation? {
    val me = body?.optJSONObject("me") ?: return null
    return Allocation(
        workDate = body.optString("work_date"),
        quota = me.optInt("quota"),
        pending = me.optInt("pending"),
        carriedOver = me.optInt("carriedOver"),
        carriedFrom = me.optString("carriedFrom").takeIf { it.isNotBlank() && it != "null" },
        newFromDatabase = me.optInt("newFromDatabase"),
        receivedFromOthers = me.optInt("receivedFromOthers"),
        movedToOthers = me.optInt("movedToOthers"),
        completed = me.optInt("completed"),
        excess = me.optInt("excess"),
        gap = me.optInt("gap"),
        poolShortage = body.optInt("shortage"),
    )
}

/** Dashboard metrics returned by /api/public/agent/dashboard-metrics. */
data class DashboardMetrics(
    val progressPercent: Int,
    val assigned: Int,
    val called: Int,
    val connected: Int,
    val interested: Int,
    val followUp: Int,
    val siteVisit: Int,
    val hotLeads: Int,
    val followUpsDue: Int,
    val newAssigned: Int,
    val missedRetry: Int,
) {
    companion object {
        fun fromJson(obj: org.json.JSONObject): DashboardMetrics = DashboardMetrics(
            progressPercent = obj.optInt("progress_percent", 0),
            assigned = obj.optInt("assigned", 0),
            called = obj.optInt("called", 0),
            connected = obj.optInt("connected", 0),
            interested = obj.optInt("interested", 0),
            followUp = obj.optInt("follow_up", 0),
            siteVisit = obj.optInt("site_visit", 0),
            hotLeads = obj.optInt("hot_leads", 0),
            followUpsDue = obj.optInt("follow_ups_due", 0),
            newAssigned = obj.optInt("new_assigned", 0),
            missedRetry = obj.optInt("missed_retry", 0),
        )
    }
}

private fun JSONObject.str(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

fun parseLeads(arr: JSONArray): List<Lead> = (0 until arr.length()).map { i ->
    val o = arr.getJSONObject(i)
    Lead(
        id = o.optString("id"),
        name = o.optString("name"),
        phone = o.optString("phone_number"),
        company = o.str("company"),
        status = o.optString("status", "pending"),
        attempts = o.optInt("call_attempts"),
        notes = o.str("notes"),
        workDate = o.str("work_date"),
        workState = o.str("work_state"),
        createdAt = o.str("created_at"),
        lastCallAt = o.str("last_call_at"),
        classifiedAt = o.str("classified_at"),
    )
}

fun parseCalls(arr: JSONArray): List<CallRow> = (0 until arr.length()).map { i ->
    val o = arr.getJSONObject(i)
    CallRow(
        id = o.optString("id"),
        leadId = o.str("lead_id"),
        phone = o.optString("phone_number"),
        durationSeconds = o.optInt("duration_seconds"),
        direction = o.optString("call_direction", "outgoing"),
        syncStatus = o.optString("sync_status", "uploaded"),
        summary = o.str("ai_summary"),
        sentiment = o.str("sentiment"),
        createdAt = o.optString("created_at"),
    )
}

fun parseMessages(arr: JSONArray): List<MessageRow> = (0 until arr.length()).map { i ->
    val o = arr.getJSONObject(i)
    MessageRow(
        id = o.optString("id"),
        leadId = o.str("lead_id"),
        senderType = o.optString("sender_type", "agent"),
        content = o.str("message_content") ?: "(মিডিয়া)",
        createdAt = o.optString("created_at"),
    )
}

fun statusLabel(status: String): String = when (status) {
    "pending" -> "অপেক্ষমাণ"
    "contacted" -> "যোগাযোগ হয়েছে"
    "follow_up" -> "ফলো-আপ"
    "closed" -> "সম্পন্ন"
    else -> status
}

fun shortTime(iso: String): String =
    iso.replace("T", " ").take(16)

/** আজকের তারিখ, ঢাকা সময়ে (YYYY-MM-DD)। */
fun dhakaToday(): String =
    java.time.LocalDate.now(java.time.ZoneId.of("Asia/Dhaka")).toString()

private fun dayOf(iso: String?): java.time.LocalDate? = runCatching {
    when {
        iso == null || iso.isBlank() -> null
        iso.length == 10 -> java.time.LocalDate.parse(iso)
        else -> java.time.Instant.parse(iso.replace(" ", "T"))
            .atZone(java.time.ZoneId.of("Asia/Dhaka")).toLocalDate()
    }
}.getOrNull()

/** টাস্কটি আগামী দিনের কাজ কি না (কাজের দিন আজকের পরে)। */
fun isUpcomingTask(lead: Lead, today: String = dhakaToday()): Boolean {
    val day = lead.workDate ?: return false
    return day > today
}

/** টাস্ক শেষ হয়েছে কি না। */
fun isTaskDone(lead: Lead): Boolean =
    lead.workState == "completed" || lead.status == "closed"

/** টাস্কটি কত দিন ধরে অপেক্ষা করছে (যেদিন এসেছে সেদিন থেকে আজ পর্যন্ত)। */
fun waitingDays(lead: Lead, today: String = dhakaToday()): Int {
    val start = dayOf(lead.createdAt) ?: return 0
    val now = dayOf(today) ?: return 0
    val days = java.time.temporal.ChronoUnit.DAYS.between(start, now).toInt()
    return if (days < 0) 0 else days
}

/** টাস্কের সময়রেখা: কবে এসেছে, শেষ হয়েছে কি না, আর কত দিন অপেক্ষায়। */
fun taskTrail(lead: Lead, today: String = dhakaToday()): String {
    val parts = mutableListOf<String>()
    dayOf(lead.createdAt)?.let { parts += "এসেছে ${it}" }
    when {
        isTaskDone(lead) -> {
            val done = dayOf(lead.classifiedAt) ?: dayOf(lead.lastCallAt)
            parts += if (done != null) "শেষ ${done}" else "শেষ হয়েছে"
        }
        isUpcomingTask(lead, today) -> parts += "আগামী দিনের কাজ (${lead.workDate})"
        lead.workDate == today -> {
            val days = waitingDays(lead, today)
            parts += if (days > 0) "আজকের কাজ · ${days} দিন অপেক্ষায়" else "আজকের কাজ"
        }
        else -> {
            val days = waitingDays(lead, today)
            parts += if (days > 0) "${days} দিন অপেক্ষায়" else "অপেক্ষমাণ"
        }
    }
    return parts.joinToString(" · ")
}
