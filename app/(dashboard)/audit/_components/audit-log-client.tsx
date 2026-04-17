"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { AuditLogTable } from "@/components/audit/audit-log-table"
import type { AuditLogRow } from "@/domain/audit/types"

interface AuditLogClientProps {
  rows: AuditLogRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  users: { id: string; name: string; email: string }[]
  currentEntityType: string
  currentUserId: string
  currentDateFrom: string
  currentDateTo: string
}

export function AuditLogClient(props: AuditLogClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleFilter = useCallback(
    (updates: {
      entityType?: string
      userId?: string
      dateFrom?: string
      dateTo?: string
      page?: number
    }) => {
      const params = new URLSearchParams(searchParams.toString())

      // Merge updates — undefined means "remove"
      const keys = ["entityType", "userId", "dateFrom", "dateTo", "page"] as const
      for (const key of keys) {
        if (key in updates) {
          const val = updates[key]
          if (val === undefined || val === "") {
            params.delete(key)
          } else {
            params.set(key, String(val))
          }
        }
      }

      // If filtering (not just paging), reset to page 1
      const nonPageKeys = (["entityType", "userId", "dateFrom", "dateTo"] as const).filter(
        (k) => k in updates
      )
      if (nonPageKeys.length > 0 && !("page" in updates)) {
        params.set("page", "1")
      }

      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  return (
    <AuditLogTable
      {...props}
      onFilter={handleFilter}
    />
  )
}
