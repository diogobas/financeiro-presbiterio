package org.example.financeiro.reporting.domain

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Spring Data JPA Repository for Account entities
 */
@Repository
interface AccountRepository : JpaRepository<Account, String> {
    fun findByStatus(status: AccountStatus): List<Account>
    fun countByStatus(status: AccountStatus): Long
}

/**
 * Spring Data JPA Repository for Category entities
 */
@Repository
interface CategoryRepository : JpaRepository<Category, String> {
    fun findByName(name: String): Category?
    fun findByTipo(tipo: TransactionType): List<Category>
    fun countByTipo(tipo: TransactionType): Long
}

/**
 * Spring Data JPA Repository for ImportBatch entities
 */
@Repository
interface ImportBatchRepository : JpaRepository<ImportBatch, String> {
    fun findByAccount(account: Account): List<ImportBatch>

    @Query("SELECT b FROM ImportBatch b WHERE b.account.id = :accountId AND b.fileChecksum = :checksum")
    fun findByAccountAndChecksum(
        @Param("accountId") accountId: String,
        @Param("checksum") checksum: String
    ): ImportBatch?

    @Query("SELECT b FROM ImportBatch b WHERE b.periodYear = :year AND b.periodMonth = :month")
    fun findByPeriod(
        @Param("year") year: Int,
        @Param("month") month: Int
    ): List<ImportBatch>

    @Query("""
        SELECT NEW map(
            COUNT(b) as totalBatches,
            COALESCE(SUM(b.rowCount), 0) as totalTransactions,
            MIN(b.uploadedAt) as minDate,
            MAX(b.uploadedAt) as maxDate
        )
        FROM ImportBatch b
        WHERE b.account.id = :accountId
    """)
    fun getStatsByAccount(@Param("accountId") accountId: String): Map<String, Any>?
}

/**
 * Spring Data JPA Repository for Transaction entities
 */
@Repository
interface TransactionRepository : JpaRepository<Transaction, String> {
    fun findByBatch(batch: ImportBatch): List<Transaction>

    @Query("SELECT t FROM Transaction t WHERE t.account.id = :accountId AND t.category IS NULL")
    fun findUnclassified(@Param("accountId") accountId: String?): List<Transaction>

    @Query("""
        SELECT t FROM Transaction t
        WHERE t.date >= :startDate AND t.date <= :endDate
        AND (:accountId IS NULL OR t.account.id = :accountId)
    """)
    fun findByDateRange(
        @Param("startDate") startDate: LocalDate,
        @Param("endDate") endDate: LocalDate,
        @Param("accountId") accountId: String?
    ): List<Transaction>

    fun findByCategory(category: Category): List<Transaction>

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.category IS NULL AND (:accountId IS NULL OR t.account.id = :accountId)")
    fun countUnclassified(@Param("accountId") accountId: String?): Long

    @Query("""
        SELECT NEW map(
            COUNT(t) as total,
            COUNT(CASE WHEN t.category IS NOT NULL THEN 1 END) as classified,
            COUNT(CASE WHEN t.category IS NULL THEN 1 END) as unclassified
        )
        FROM Transaction t
        WHERE (:accountId IS NULL OR t.account.id = :accountId)
        AND (:startDate IS NULL OR t.date >= :startDate)
        AND (:endDate IS NULL OR t.date <= :endDate)
    """)
    fun getStatistics(
        @Param("accountId") accountId: String?,
        @Param("startDate") startDate: LocalDate?,
        @Param("endDate") endDate: LocalDate?
    ): Map<String, Any>?
}

/**
 * Spring Data JPA Repository for Rule entities
 */
@Repository
interface RuleRepository : JpaRepository<Rule, String> {
    fun findByActiveTrue(): List<Rule>
    fun findByCategory(category: Category): List<Rule>
    fun findByTipo(tipo: TransactionType): List<Rule>
    fun findByActiveTrueAndTipo(tipo: TransactionType): List<Rule>
    fun countByActiveTrue(): Long
}

/**
 * Spring Data JPA Repository for ClassificationOverride entities
 */
@Repository
interface ClassificationOverrideRepository : JpaRepository<ClassificationOverride, String> {
    fun findByTransaction(transaction: Transaction): ClassificationOverride?

    @Query("SELECT o FROM ClassificationOverride o WHERE o.actor = :actor")
    fun findByActor(@Param("actor") actor: String): List<ClassificationOverride>

    @Query("""
        SELECT o FROM ClassificationOverride o
        WHERE o.createdAt >= :startDate AND o.createdAt <= :endDate
    """)
    fun findByDateRange(
        @Param("startDate") startDate: LocalDateTime,
        @Param("endDate") endDate: LocalDateTime
    ): List<ClassificationOverride>

    @Query("""
        SELECT NEW map(
            COUNT(o) as total,
            COUNT(DISTINCT o.actor) as uniqueActors,
            COUNT(DISTINCT o.newCategory.id) as uniqueCategories
        )
        FROM ClassificationOverride o
        WHERE (:startDate IS NULL OR o.createdAt >= :startDate)
        AND (:endDate IS NULL OR o.createdAt <= :endDate)
    """)
    fun getStatistics(
        @Param("startDate") startDate: LocalDateTime?,
        @Param("endDate") endDate: LocalDateTime?
    ): Map<String, Any>?
}

/**
 * Spring Data JPA Repository for MaterializedView (CategoryTotals)
 * Read-only repository for reporting queries
 */
@Repository
interface CategoryTotalsViewRepository : JpaRepository<CategoryTotalsView, Long> {
    @Query("""
        SELECT v FROM CategoryTotalsView v
        WHERE (:year IS NULL OR v.year = :year)
        AND (:month IS NULL OR v.month = :month)
        AND (:accountId IS NULL OR v.accountId = :accountId)
    """)
    fun findTotals(
        @Param("year") year: Int?,
        @Param("month") month: Int?,
        @Param("accountId") accountId: String?
    ): List<CategoryTotalsView>

    @Query("SELECT v FROM CategoryTotalsView v WHERE v.accountId = :accountId AND (:year IS NULL OR v.year = :year)")
    fun findByAccount(
        @Param("accountId") accountId: String,
        @Param("year") year: Int?
    ): List<CategoryTotalsView>

    @Query("""
        SELECT NEW map(
            SUM(v.totalAmount) as totalAmount,
            SUM(v.rowCount) as totalRows,
            COUNT(DISTINCT v.categoryId) as categoryCount
        )
        FROM CategoryTotalsView v
        WHERE v.accountId = :accountId
        AND (:year IS NULL OR v.year = :year)
    """)
    fun getSummary(
        @Param("accountId") accountId: String,
        @Param("year") year: Int?
    ): Map<String, Any>?
}
