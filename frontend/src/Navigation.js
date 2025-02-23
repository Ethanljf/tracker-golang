import React from 'react'
import { Link as ReactRouterLink } from 'react-router-dom'
import { Flex, Stack } from '@chakra-ui/core'
import { node } from 'prop-types'

export const Navigation = ({ children, ...props }) => {
  return (
    <Flex
      as="nav"
      align="center"
      justify="space-between"
      wrap="wrap"
      padding={{ sm: '0.6rem', md: '0.80rem', lg: '1rem', xl: '1rem' }}
      bg="#fff"
      py="4px"
      color="primary"
      borderBottom="2px solid"
      borderBottomColor="gray.300"
      display={{ base: 'none', md: 'flex' }}
      {...props}
    >
      <Flex
        maxW={{ sm: 540, md: 768, lg: 960, xl: 1200 }}
        mx="auto"
        px={{md: 2, lg: 4 }}
        w="100%"
        align="center"
        direction="row"
      >
        <Stack
          isInline
          alignItems="center"
          flexWrap="wrap"
          spacing={{md: 4, lg: 6 }}
          w="100%"
        >
          {React.Children.map(children, (child) => {
            if (child !== null) {
              return React.cloneElement(child, {
                as: ReactRouterLink,
              })
            }
          })}
        </Stack>
      </Flex>
    </Flex>
  )
}

Navigation.propTypes = {
  children: node,
}
