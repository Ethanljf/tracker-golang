import React, { useState } from 'react'
import { useUserState } from './UserState'
import { useQuery } from '@apollo/client'
import { DMARC_REPORT_SUMMARY_TABLE } from './graphql/queries'
import { Box, Heading, Text, Stack, Select } from '@chakra-ui/core'
import DmarcReportTable from './DmarcReportTable'
import { t, Trans } from '@lingui/macro'
import { useLingui } from '@lingui/react'
import {months} from "./months";

export default function DmarcByDomainPage() {
  const { currentUser } = useUserState()
  const { i18n } = useLingui()
  const currentDate = new Date()
  const [selectedPeriod, setSelectedPeriod] = useState('LAST30DAYS')
  const [selectedYear, setSelectedYear] = useState(
    currentDate.getFullYear().toString(),
  )
  const [selectedDate, setSelectedDate] = useState(
    `LAST30DAYS, ${currentDate.getFullYear()}`,
  )

  const {
    loading: tableLoading,
    error: tableError,
    data: tableData,
  } = useQuery(DMARC_REPORT_SUMMARY_TABLE, {
    context: {
      headers: {
        authorization: currentUser.jwt,
      },
    },
    variables: {
      period: selectedPeriod,
      year: selectedYear,
    },
  })

  // TODO: Properly handle these errors
  if (tableError)
    return (
      <Heading as="h3" size="lg" textAlign="center">
        <Trans>Error while querying for DMARC report summary table</Trans>
      </Heading>
    )

  // Initial sorting category for detail tables
  const initialSort = [{ id: 'totalMessages', desc: true }]

  const [
    domain,
    totalMessages,
    fullPassPercentage,
    passSpfOnlyPercentage,
    passDkimOnlyPercentage,
    failPercentage,
  ] = [
    { Header: i18n._(t`Domain`), accessor: 'domain' },
    { Header: i18n._(t`Total Messages`), accessor: 'totalMessages' },
    {
      Header: i18n._(t`Full Pass %`),
      accessor: 'fullPassPercentage',
    },
    {
      Header: i18n._(t`Fail DKIM %`),
      accessor: 'passSpfOnlyPercentage',
    },
    {
      Header: i18n._(t`Fail SPF %`),
      accessor: 'passDkimOnlyPercentage',
    },
    { Header: i18n._(t`Full Fail %`), accessor: 'failPercentage' },
  ]

  const percentageColumns = [
    {
      Header: i18n._(t`DMARC Messages`),
      hidden: true,
      columns: [
        domain,
        totalMessages,
        fullPassPercentage,
        passDkimOnlyPercentage,
        passSpfOnlyPercentage,
        failPercentage,
      ],
    },
  ]

  const options = [
    <option
      key="LAST30DAYS"
      value={`LAST30DAYS, ${currentDate.getFullYear().toString()}`}
    >
      {i18n._(t`Last 30 Days`)}
    </option>,
  ]

  // add dmarc date selection options
  for (let i = currentDate.getMonth(), j = 13; j > 0; i--, j--) {
    // handle previous year
    if (i < 0) {
      const value = `${months[months.length + i].toUpperCase()}, ${
        currentDate.getFullYear() - 1
      }`
      const translatedValue = `${i18n
        ._(months[months.length + i])
        .toUpperCase()}, ${currentDate.getFullYear() - 1}`

      options.push(
        <option key={value} value={value}>
          {translatedValue}
        </option>,
      )
    }
    // handle current year
    else {
      const value = `${months[i].toUpperCase()}, ${currentDate.getFullYear()}`
      const translatedValue = `${i18n
        ._(months[i])
        .toUpperCase()}, ${currentDate.getFullYear()}`

      options.push(
        <option key={value} value={value}>
          {translatedValue}
        </option>,
      )
    }
  }

  const handleChange = (e) => {
    setSelectedDate(e.target.value)
    const [newPeriod, newYear] = e.target.value.split(', ')
    setSelectedPeriod(newPeriod)
    setSelectedYear(newYear)
  }

  // Replace table with "Loading..." if waiting for query
  const tableDisplay = tableLoading ? (
    <Text>
      <Trans>Loading...</Trans>
    </Text>
  ) : (
    <DmarcReportTable
      data={tableData.dmarcReportSummaryTable.domains}
      columns={percentageColumns}
      title={i18n._(t`Pass/Fail Ratios by Domain`)}
      initialSort={initialSort}
      mb="30px"
      hideTitleButton={true}
      linkColumns={[{ column: 'domain', isExternal: false }]}
      prependLink="domains/"
      appendLink={`/dmarc-report/${selectedPeriod}/${selectedYear}`}
    />
  )

  return (
    <Box width="100%">
      <Heading as="h1" textAlign="center" size="lg" mb="4px">
        <Trans>DMARC Messages</Trans>
      </Heading>

      <Stack isInline align="center" mb="4px">
        <Text fontWeight="bold" textAlign="center">
          <Trans>Showing data for period: </Trans>
        </Text>
        <Select
          width="fit-content"
          onChange={(e) => handleChange(e)}
          value={selectedDate}
        >
          {options}
        </Select>
      </Stack>

      {tableDisplay}
    </Box>
  )
}

DmarcByDomainPage.propTypes = {}