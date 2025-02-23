const updateMonthSummary = (
  calculatePercentages,
  createSummary,
  createSummaryEdge,
  loadSummaryByDate,
  removeSummaryEdge,
  removeSummary,
) => async ({ dateToRemove, dateToAdd, domain, domainId }) => {
  // Remove summary edge
  const currentEdge = await removeSummaryEdge({
    domainId,
    monthToRemove: dateToRemove,
  })

  if (typeof currentEdge === 'undefined') {
    return undefined
  }

  // Remove summary
  await removeSummary({ summaryId: currentEdge._to })

  const currentSummary = await loadSummaryByDate({
    domain,
    startDate: dateToAdd,
  })

  const { totalMessages, percentages } = calculatePercentages(
    currentSummary.categoryTotals,
  )
  
  currentSummary.totalMessages = totalMessages
  currentSummary.categoryPercentages = percentages

  const summaryDBInfo = await createSummary({ currentSummary })

  await createSummaryEdge({
    domainId,
    summaryId: summaryDBInfo._id,
    startDate: dateToAdd,
  })
}

module.exports = {
  updateMonthSummary,
}
