package org.example.financeiro.reporting.domain

import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID
import jakarta.persistence.*
import org.hibernate.annotations.Immutable

/**
 * Account Entity - JPA mapping for bank accounts
 * Maps to PostgreSQL account table
 */
@Entity
@Table(name = "account")
data class Account(
    @Id
    val id: UUID = UUID.fromString("00000000-0000-0000-0000-000000000000"),

    @Column(nullable = false, length = 255)
    val name: String = "",

    @Column(name = "bank_name", length = 255)
    val bankName: String? = null,

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    val status: AccountStatus = AccountStatus.ACTIVE,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime = LocalDateTime.now(),

    @OneToMany(mappedBy = "account", cascade = [CascadeType.ALL], fetch = FetchType.LAZY)
    val importBatches: MutableSet<ImportBatch> = mutableSetOf(),

    @OneToMany(mappedBy = "account", cascade = [CascadeType.ALL], fetch = FetchType.LAZY)
    val transactions: MutableSet<Transaction> = mutableSetOf()
) {
    override fun equals(other: Any?) = other is Account && id == other.id
    override fun hashCode() = id.hashCode()
}

enum class AccountStatus {
    ACTIVE, INACTIVE, ARCHIVED
}

/**
 * Category Entity - JPA mapping for transaction categories
 * Maps to PostgreSQL category table
 */
@Entity
@Table(name = "category", indexes = [
    Index(columnList = "tipo"),
    Index(columnList = "name", unique = true)
])
data class Category(
    @Id
    val id: UUID = UUID.fromString("00000000-0000-0000-0000-000000000000"),

    @Column(nullable = false, length = 255, unique = true)
    val name: String = "",

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    val tipo: TransactionType = TransactionType.RECEITA,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @OneToMany(mappedBy = "category", fetch = FetchType.LAZY)
    val rules: MutableSet<Rule> = mutableSetOf(),

    @OneToMany(mappedBy = "category", fetch = FetchType.LAZY)
    val transactions: MutableSet<Transaction> = mutableSetOf()
) {
    override fun equals(other: Any?) = other is Category && id == other.id
    override fun hashCode() = id.hashCode()
}

enum class TransactionType {
    RECEITA, DESPESA
}

/**
 * ImportBatch Entity - JPA mapping for CSV import metadata
 * Maps to PostgreSQL import_batch table
 */
@Entity
@Table(name = "import_batch", indexes = [
    Index(columnList = "account_id"),
    Index(columnList = "uploaded_at"),
    Index(columnList = "period_year, period_month"),
    Index(columnList = "file_checksum")
], uniqueConstraints = [
    UniqueConstraint(columnNames = ["account_id", "file_checksum", "period_month", "period_year"])
])
data class ImportBatch(
    @Id
    val id: UUID = UUID.fromString("00000000-0000-0000-0000-000000000000"),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    val account: Account? = null,

    @Column(name = "uploaded_by", nullable = false, length = 255)
    val uploadedBy: String = "",

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    val uploadedAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "file_checksum", nullable = false, length = 64)
    val fileChecksum: String = "",

    @Column(name = "period_month", nullable = false)
    val periodMonth: Int = 1,

    @Column(name = "period_year", nullable = false)
    val periodYear: Int = 2025,

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    val encoding: EncodingType = EncodingType.UTF8,

    @Column(name = "row_count", nullable = false)
    val rowCount: Int = 0,

    @OneToMany(mappedBy = "batch", cascade = [CascadeType.ALL], fetch = FetchType.LAZY)
    val transactions: MutableSet<Transaction> = mutableSetOf()
) {
    override fun equals(other: Any?) = other is ImportBatch && id == other.id
    override fun hashCode() = id.hashCode()
}

enum class EncodingType {
    UTF8, LATIN1
}

/**
 * Transaction Entity - JPA mapping for imported transactions
 * Maps to PostgreSQL transaction table
 */
@Entity
@Table(name = "transaction", indexes = [
    Index(columnList = "account_id"),
    Index(columnList = "batch_id"),
    Index(columnList = "category_id"),
    Index(columnList = "date"),
    Index(columnList = "created_at"),
    Index(columnList = "documento_normalized"),
    Index(columnList = "account_id, category_id")
])
data class Transaction(
    @Id
    val id: UUID = UUID.fromString("00000000-0000-0000-0000-000000000000"),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    val account: Account? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    val batch: ImportBatch? = null,

    @Column(nullable = false)
    val date: LocalDate = LocalDate.now(),

    @Column(nullable = false, length = 255)
    val documento: String = "",

    @Column(name = "documento_normalized", length = 255, insertable = false, updatable = false)
    val documentoNormalized: String? = null,

    @Column(nullable = false, precision = 14, scale = 2)
    val amount: BigDecimal = BigDecimal.ZERO,

    @Column(nullable = false, length = 3)
    val currency: String = "BRL",

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    val category: Category? = null,

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    val classificationSource: ClassificationSource = ClassificationSource.NONE,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rule_id")
    val rule: Rule? = null,

    @Column(name = "rule_version")
    val ruleVersion: Int? = null,

    @Column(length = 1024)
    val rationale: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime = LocalDateTime.now(),

    @OneToOne(mappedBy = "transaction", cascade = [CascadeType.ALL], fetch = FetchType.LAZY)
    val override: ClassificationOverride? = null
) {
    override fun equals(other: Any?) = other is Transaction && id == other.id
    override fun hashCode() = id.hashCode()
}

enum class ClassificationSource {
    RULE, OVERRIDE, NONE
}

/**
 * Rule Entity - JPA mapping for classification rules
 * Maps to PostgreSQL rule table
 */
@Entity
@Table(name = "rule", indexes = [
    Index(columnList = "active"),
    Index(columnList = "category_id"),
    Index(columnList = "tipo"),
    Index(columnList = "created_at")
])
data class Rule(
    @Id
    val id: UUID = UUID.fromString("00000000-0000-0000-0000-000000000000"),

    @Column(nullable = false)
    val version: Int = 1,

    @Column(name = "matcher_type", nullable = false)
    @Enumerated(EnumType.STRING)
    val matcherType: MatcherType = MatcherType.CONTAINS,

    @Column(nullable = false, length = 1024)
    val pattern: String = "",

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    val category: Category? = null,

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    val tipo: TransactionType = TransactionType.RECEITA,

    @Column(name = "created_by", nullable = false, length = 255)
    val createdBy: String = "",

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(nullable = false)
    val active: Boolean = true,

    @OneToMany(mappedBy = "rule", fetch = FetchType.LAZY)
    val transactions: MutableSet<Transaction> = mutableSetOf()
) {
    override fun equals(other: Any?) = other is Rule && id == other.id
    override fun hashCode() = id.hashCode()
}

enum class MatcherType {
    CONTAINS, REGEX
}

/**
 * ClassificationOverride Entity - JPA mapping for audit trail
 * Maps to PostgreSQL classification_override table
 */
@Entity
@Table(name = "classification_override", indexes = [
    Index(columnList = "transaction_id"),
    Index(columnList = "created_at"),
    Index(columnList = "actor")
])
data class ClassificationOverride(
    @Id
    val id: UUID = UUID.fromString("00000000-0000-0000-0000-000000000000"),

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", nullable = false, unique = true)
    val transaction: Transaction? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "previous_category_id")
    val previousCategory: Category? = null,

    @Column(name = "previous_tipo")
    @Enumerated(EnumType.STRING)
    val previousTipo: TransactionType? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "new_category_id", nullable = false)
    val newCategory: Category? = null,

    @Column(name = "new_tipo", nullable = false)
    @Enumerated(EnumType.STRING)
    val newTipo: TransactionType = TransactionType.RECEITA,

    @Column(nullable = false, length = 255)
    val actor: String = "",

    @Column(length = 1024)
    val reason: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    override fun equals(other: Any?) = other is ClassificationOverride && id == other.id
    override fun hashCode() = id.hashCode()
}

/**
 * Materialized View - CategoryTotals (read-only)
 * For fast reporting queries without impacting transaction performance
 */
@Entity
@Table(name = "mv_category_totals")
@Immutable
data class CategoryTotalsView(
    @Id
    @Column(nullable = false)
    val year: Int = 2025,

    @Column(nullable = false)
    val month: Int = 1,

    @Column(name = "account_id", nullable = false)
    val accountId: UUID = UUID.fromString("00000000-0000-0000-0000-000000000000"),

    @Column(name = "category_id")
    val categoryId: UUID? = null,

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    val tipo: TransactionType? = null,

    @Column(name = "total_amount", nullable = false, precision = 14, scale = 2)
    val totalAmount: BigDecimal = BigDecimal.ZERO,

    @Column(name = "row_count", nullable = false)
    val rowCount: Int = 0
) {
    override fun equals(other: Any?) = other is CategoryTotalsView && year == other.year && month == other.month && accountId == other.accountId && categoryId == other.categoryId
    override fun hashCode() = year.hashCode() xor month.hashCode() xor accountId.hashCode() xor (categoryId?.hashCode() ?: 0)
}
