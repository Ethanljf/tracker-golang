const initializeSummaries = (
  calculatePercentages,
  createSummaryEdge,
  createSummary,
  loadSummaryByDate,
) => async ({ domain, domainId, dates }) => {
  console.info(`\tFirst time initialization of dmarc summaries for: ${domain}`)

  // Add thirty_days
  dates.push({ startDate: 'thirty_days' })

  for (const date of dates) {
    const currentSummary = await loadSummaryByDate({
      domain,
      startDate: date.startDate,
    })
    const { totalMessages, percentages } = calculatePercentages(
      currentSummary.categoryTotals,
    )

    currentSummary.totalMessages = totalMessages
    currentSummary.categoryPercentages = percentages

    const summaryDBInfo = await createSummary({ currentSummary })

    let startDate
    if (date.startDate === 'thirty_days') {
      startDate = 'thirtyDays'
    } else {
      startDate = date.startDate
    }

    await createSummaryEdge({
      domainId,
      summaryId: summaryDBInfo._id,
      startDate,
    })
  }
}

module.exports = {
  initializeSummaries,
}
