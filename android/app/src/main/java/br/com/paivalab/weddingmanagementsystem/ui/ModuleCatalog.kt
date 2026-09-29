package br.com.paivalab.weddingmanagementsystem.ui

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Flight
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Hotel
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Money
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Savings
import androidx.compose.material.icons.filled.TableRestaurant
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.ui.graphics.vector.ImageVector
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.Kinds

data class ModuleDefinition(
    val kind: String,
    @StringRes val title: Int,
    val icon: ImageVector,
    val statuses: List<String> = emptyList(),
    val hasAmount: Boolean = false,
    val hasDate: Boolean = false,
    val hasContact: Boolean = false,
    val parentKind: String? = null,
)

val modules = listOf(
    ModuleDefinition(Kinds.TASK, R.string.tasks, Icons.Default.TaskAlt, listOf("TODO", "IN_PROGRESS", "DONE", "BLOCKED"), hasDate = true),
    ModuleDefinition(Kinds.VENDOR, R.string.vendors, Icons.Default.People, listOf("NEGOTIATION", "CONTRACTED", "FINALIZED"), hasContact = true),
    ModuleDefinition(Kinds.GUEST, R.string.guests, Icons.Default.Person, listOf("NOT_INVITED", "INVITED", "CONFIRMED", "DECLINED", "MAYBE"), hasContact = true),
    ModuleDefinition(Kinds.VENUE, R.string.venues, Icons.Default.Hotel, hasAmount = true, hasContact = true),
    ModuleDefinition(Kinds.BUDGET, R.string.budget, Icons.Default.Receipt, hasAmount = true, parentKind = Kinds.VENDOR),
    ModuleDefinition(Kinds.PAYMENT, R.string.payments, Icons.Default.CreditCard, listOf("PENDING", "PAID"), true, true, parentKind = Kinds.VENDOR),
    ModuleDefinition(Kinds.INCOME, R.string.income, Icons.Default.Payments, listOf("EXPECTED", "RECEIVED", "CANCELLED"), true, true),
    ModuleDefinition(Kinds.ASSET, R.string.assets, Icons.Default.AccountBalanceWallet, hasAmount = true, hasDate = true, parentKind = Kinds.GOAL),
    ModuleDefinition(Kinds.GOAL, R.string.goals, Icons.Default.Flag, hasAmount = true, hasDate = true),
    ModuleDefinition(Kinds.GROUP, R.string.groups, Icons.Default.Group, hasContact = true),
    ModuleDefinition(Kinds.TAG, R.string.tags, Icons.Default.LocalOffer),
    ModuleDefinition(Kinds.GIFT, R.string.gifts, Icons.Default.Favorite, listOf("PENDING", "RECEIVED", "THANKED", "PROCESSED"), true, parentKind = Kinds.GUEST),
    ModuleDefinition(Kinds.HONEYMOON, R.string.honeymoon, Icons.Default.Flight, hasAmount = true, hasDate = true),
    ModuleDefinition(Kinds.HONEYMOON_ITEM, R.string.honeymoon_items, Icons.Default.Inventory, listOf("PLANNED", "BOOKED", "CONFIRMED", "PAID", "CANCELLED"), true, true, parentKind = Kinds.HONEYMOON),
    ModuleDefinition(Kinds.TROUSSEAU, R.string.trousseau, Icons.Default.Inventory, listOf("TO_BUY", "BOUGHT", "GIFTED"), true),
    ModuleDefinition(Kinds.TABLE, R.string.seating, Icons.Default.TableRestaurant, hasAmount = true),
    ModuleDefinition(Kinds.CONTRACT, R.string.contracts, Icons.Default.EditNote, listOf("DRAFT", "SENT", "NEGOTIATING", "SIGNED_DIGITAL", "SIGNED_PHYSICAL", "CANCELLED"), true, true, parentKind = Kinds.VENDOR),
    ModuleDefinition(Kinds.CONTACT, R.string.contacts, Icons.Default.Person, hasContact = true, parentKind = Kinds.VENDOR),
    ModuleDefinition(Kinds.VENUE_CHECK, R.string.venue_check, Icons.Default.CheckCircle, listOf("TODO", "DONE"), parentKind = Kinds.VENUE),
    ModuleDefinition(Kinds.VENDOR_NOTE, R.string.vendor_notes, Icons.Default.EditNote, parentKind = Kinds.VENDOR),
    ModuleDefinition(Kinds.INVITATION, R.string.invitations, Icons.Default.Mail),
    ModuleDefinition(Kinds.SAVE_THE_DATE, R.string.save_the_date, Icons.Default.CalendarMonth),
)
