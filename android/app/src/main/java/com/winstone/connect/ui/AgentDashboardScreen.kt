package com.winstone.connect.ui

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.winstone.connect.data.AgentSession
import com.winstone.connect.data.DashboardMetrics
import com.winstone.connect.data.Lead
import com.winstone.connect.data.remote.WinstoneApi
import com.winstone.connect.telephony.LiveCallLauncher
import com.winstone.connect.ui.theme.WinAmber
import com.winstone.connect.ui.theme.WinBorder
import com.winstone.connect.ui.theme.WinCreamDeep
import com.winstone.connect.ui.theme.WinGreen
import com.winstone.connect.ui.theme.WinGreenSoft
import com.winstone.connect.ui.theme.WinInk
import com.winstone.connect.ui.theme.WinInkMuted
import com.winstone.connect.ui.theme.WinLive
import com.winstone.connect.ui.theme.WinRed
import com.winstone.connect.ui.theme.WinSurface
import kotlinx.coroutines.launch

/**
 * V2.10 Agent Dashboard — daily authoritative KPIs from the same server API as web.
 *
 * The phone never computes its own target, pending count or performance numbers.
 * Everything here comes from /api/public/agent/dashboard-metrics, so the Android
 * app, the web desk and Executive HQ always show the same figures.
 *
 * Metrics shown:
 *   - লক্ষ্য (target quota)
 *   - হাতে আছে (assigned/held workload)
 *   - কল করা (actual calls attempted)
 *   - কথা হয়েছে (connected calls)
 *   - সম্ভাবনাময় (qualified leads)
 *   - ফলো-আপ শেষ (follow-ups completed, with due hint)
 *   - সাইট ভিজিট (site visits completed, with scheduled hint)
 *   - বুকিং (bookings)
 *   - অতিরিক্ত পেন্ডিং (excess pending / dispute)
 */
@Composable
fun AgentDashboardScreen(
    activity: Activity,
    agentName: String,
    employeeId: String,
    leads: List<Lead>,
    onLeadDetail: (Lead) -> Unit = {},
    onViewAllLeads: () -> Unit = {},
    onViewAllFollowUps: () -> Unit = {},
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var metrics by remember { mutableStateOf<DashboardMetrics?>(null) }
    var loading by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        loading = true
        metrics = runCatching { WinstoneApi.fetchDashboardMetrics() }
            .getOrNull()
            ?.let { DashboardMetrics.fromJson(it) }
        loading = false
    }

    val today = remember {
        java.text.SimpleDateFormat("EEEE, dd MMMM yyyy", java.util.Locale("bn", "BD"))
            .format(java.util.Date())
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { DashboardHeader(agentName = agentName, employeeId = employeeId, today = today) }

        item {
            ProgressCard(
                percent = metrics?.progressPercent ?: 0,
                target = metrics?.target ?: 0,
                assigned = metrics?.assigned ?: 0,
                called = metrics?.called ?: 0,
                connected = metrics?.connected ?: 0,
            )
        }

        item {
            Text(
                "আজকের আসল কাজ",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = WinInk,
                modifier = Modifier.padding(top = 2.dp),
            )
        }

        // 3x3 authoritative KPI grid — same names and sources as the web CRM.
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MetricBox(
                        label = "লক্ষ্য",
                        value = metrics?.target?.toString() ?: "0",
                        hint = "কোটা",
                        modifier = Modifier.weight(1f),
                        accent = WinInkMuted,
                    )
                    MetricBox(
                        label = "হাতে আছে",
                        value = metrics?.assigned?.toString() ?: "0",
                        hint = "অ্যাসাইন করা",
                        modifier = Modifier.weight(1f),
                        accent = WinAmber,
                    )
                    MetricBox(
                        label = "কল করা",
                        value = metrics?.called?.toString() ?: "0",
                        hint = "আসল কল",
                        modifier = Modifier.weight(1f),
                        accent = WinGreen,
                    )
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MetricBox(
                        label = "কথা হয়েছে",
                        value = metrics?.connected?.toString() ?: "0",
                        hint = "${metrics?.connectRate ?: 0}% সংযোগ",
                        modifier = Modifier.weight(1f),
                        accent = WinGreen,
                    )
                    MetricBox(
                        label = "সম্ভাবনাময়",
                        value = metrics?.qualified?.toString() ?: "0",
                        hint = "Qualified",
                        modifier = Modifier.weight(1f),
                        accent = WinAmber,
                    )
                    MetricBox(
                        label = "ফলো-আপ",
                        value = metrics?.followUpsCompleted?.toString() ?: "0",
                        hint = "${metrics?.followUpsDue ?: 0}টি বাকি",
                        modifier = Modifier.weight(1f),
                        accent = WinLive,
                    )
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MetricBox(
                        label = "সাইট ভিজিট",
                        value = metrics?.siteVisitsCompleted?.toString() ?: "0",
                        hint = "${metrics?.siteVisitsScheduled ?: 0}টি নির্ধারিত",
                        modifier = Modifier.weight(1f),
                        accent = WinLive,
                    )
                    MetricBox(
                        label = "বুকিং",
                        value = metrics?.bookings?.toString() ?: "0",
                        hint = "${metrics?.conversionRate ?: 0}% রূপান্তর",
                        modifier = Modifier.weight(1f),
                        accent = WinGreen,
                    )
                    MetricBox(
                        label = "শেষ টাস্ক",
                        value = metrics?.completedTasks?.toString() ?: "0",
                        hint = metrics?.takeIf { it.talkTimeAvailable }
                            ?.let { "${it.talkMinutes} মিনিট কথা" }
                            ?: "কথার সময় অনুপলব্ধ",
                        modifier = Modifier.weight(1f),
                        accent = WinGreen,
                    )
                    MetricBox(
                        label = "ধরেনি",
                        value = metrics?.unansweredCalls?.toString() ?: "0",
                        hint = "আবার কল হবে",
                        modifier = Modifier.weight(1f),
                        accent = WinRed,
                    )
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MetricBox(
                        label = "অতিরিক্ত পেন্ডিং",
                        value = metrics?.excessPending?.toString() ?: "0",
                        hint = "মীমাংসাধীন",
                        modifier = Modifier.weight(1f),
                        accent = WinRed,
                    )
                }
            }
        }

        item {
            StartCallingCard(
                onStart = {
                    val next = leads.firstOrNull { it.status == "pending" || it.status == "follow_up" }
                    next?.let { lead ->
                        scope.launch {
                            val gate = runCatching { WinstoneApi.startCall(lead.id) }.getOrNull()
                            if (gate?.optBoolean("blocked", false) == true) {
                                // blocked — handled by caller via pending report gate
                            } else {
                                LiveCallLauncher.call(activity, lead.id, lead.phone, AgentSession.agentId, lead.name)
                            }
                        }
                    }
                },
                enabled = leads.isNotEmpty(),
            )
        }

        item {
            Text(
                "Today's Priorities",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = WinInk,
                modifier = Modifier.padding(top = 6.dp),
            )
        }

        item {
            PriorityCard(
                label = "আগের দিনের বাকি",
                count = metrics?.carriedOver ?: 0,
                icon = Icons.Filled.Person,
                color = WinRed,
                onClick = onViewAllLeads,
            )
        }
        item {
            PriorityCard(
                label = "Follow-ups Due",
                count = metrics?.followUpsDue ?: 0,
                icon = Icons.Filled.Notifications,
                color = WinAmber,
                onClick = onViewAllFollowUps,
            )
        }
        item {
            PriorityCard(
                label = "ডেটাবেজ থেকে নতুন",
                count = metrics?.newFromDatabase ?: 0,
                icon = Icons.Filled.Person,
                color = WinGreen,
                onClick = onViewAllLeads,
            )
        }

        item {
            Text(
                "আজকের নির্ধারিত কল",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = WinInk,
                modifier = Modifier.padding(top = 6.dp),
            )
        }

        val queue = leads.filter { it.status == "follow_up" || it.status == "pending" }.take(5)
        if (queue.isEmpty()) {
            item { EmptyNote("আজ নির্ধারিত কোনো কল নেই।") }
        } else {
            items(queue) { lead ->
                ScheduledCallRowV2(lead = lead, onClick = { onLeadDetail(lead) })
            }
        }

        item { Spacer(Modifier.height(80.dp)) }
    }

    if (loading && metrics == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = WinGreen)
        }
    }
}

@Composable
private fun DashboardHeader(agentName: String, employeeId: String, today: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                "Good Morning",
                color = WinInkMuted,
                fontSize = 13.sp,
            )
            Text(
                agentName,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                color = WinInk,
            )
            Text(
                "$employeeId · Sales Agent",
                color = WinGreen,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Box(contentAlignment = Alignment.TopEnd) {
            Icon(
                Icons.Filled.Notifications,
                contentDescription = "Notifications",
                tint = WinInk,
                modifier = Modifier.size(28.dp),
            )
            // notification dot
            Box(
                Modifier
                    .size(8.dp)
                    .background(WinRed, CircleShape)
                    .align(Alignment.TopEnd),
            )
        }
    }
    Text(
        today,
        color = WinInkMuted,
        fontSize = 12.sp,
        modifier = Modifier.padding(top = 8.dp),
    )
}

@Composable
private fun ProgressCard(
    percent: Int,
    target: Int,
    assigned: Int,
    called: Int,
    connected: Int,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = WinSurface),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Today's Progress",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = WinInk,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "$percent%",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = WinGreen,
                )
            }
            Spacer(Modifier.height(10.dp))
            LinearProgressIndicator(
                progress = { percent.coerceIn(0, 100) / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = WinGreen,
                trackColor = WinGreenSoft,
            )
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MetricBox(label = "Target", value = target.toString(), modifier = Modifier.weight(1f))
                MetricBox(label = "Held", value = assigned.toString(), modifier = Modifier.weight(1f))
                MetricBox(label = "Called", value = called.toString(), modifier = Modifier.weight(1f))
                MetricBox(label = "Connected", value = connected.toString(), modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun MetricBox(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    hint: String? = null,
    accent: Color = WinInkMuted,
) {
    Column(
        modifier = modifier
            .background(WinCreamDeep, RoundedCornerShape(12.dp))
            .padding(vertical = 10.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = WinInk)
        Text(label, fontSize = 10.sp, color = WinInkMuted, lineHeight = 12.sp)
        if (hint != null) {
            Text(hint, fontSize = 9.sp, color = accent, fontWeight = FontWeight.SemiBold, lineHeight = 11.sp)
        }
    }
}

@Composable
private fun StartCallingCard(onStart: () -> Unit, enabled: Boolean) {
    Card(
        colors = CardDefaults.cardColors(containerColor = WinGreenSoft),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(WinGreen),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Call, contentDescription = null, tint = Color(0xFF17130A), modifier = Modifier.size(24.dp))
            }
            Column(Modifier.weight(1f)) {
                Text("Start Calling", fontWeight = FontWeight.Bold, fontSize = 17.sp, color = WinInk)
                Text("পরবর্তী লিডে কল দিন", fontSize = 12.sp, color = WinInkMuted)
            }
            Button(
                onClick = onStart,
                enabled = enabled,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = WinGreen, contentColor = Color(0xFF17130A)),
            ) {
                Icon(Icons.Filled.Call, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("Call", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun PriorityCard(
    label: String,
    count: Int,
    icon: ImageVector,
    color: Color,
    onClick: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = WinSurface),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
    ) {
        Row(
            Modifier
                .padding(14.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(color.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = label, tint = color, modifier = Modifier.size(18.dp))
            }
            Text(
                label,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = WinInk,
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 12.dp),
            )
            BadgedBox(badge = {
                Badge(containerColor = color, contentColor = WinInk) {
                    Text(count.toString(), fontSize = 10.sp)
                }
            }) {
                Box(Modifier.size(20.dp))
            }
        }
    }
}

@Composable
private fun ScheduledCallRowV2(lead: Lead, onClick: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = WinSurface),
        shape = RoundedCornerShape(14.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, WinBorder),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
    ) {
        Row(
            Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(WinGreenSoft),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    lead.name.trim().split(" ").mapNotNull { it.firstOrNull()?.uppercase() }.take(1).joinToString("").ifBlank { "L" },
                    color = WinGreen,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
            }
            Column(
                Modifier
                    .weight(1f)
                    .padding(start = 12.dp),
            ) {
                Text(lead.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = WinInk)
                Text(lead.phone, fontSize = 12.sp, color = WinInkMuted)
            }
            StatusPill(lead.status)
        }
    }
}

@Composable
private fun StatusPill(status: String) {
    val (label, color) = when (status) {
        "pending" -> "Pending" to WinAmber
        "follow_up" -> "Follow-up" to WinGreen
        "contacted" -> "Contacted" to WinLive
        "closed" -> "Closed" to WinInkMuted
        else -> status to WinInkMuted
    }
    Text(
        label,
        fontSize = 10.sp,
        fontWeight = FontWeight.SemiBold,
        color = color,
        modifier = Modifier
            .background(color.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
    )
}

@Composable
private fun EmptyNote(text: String) {
    Text(text, color = WinInkMuted, fontSize = 13.sp, modifier = Modifier.padding(vertical = 8.dp))
}
