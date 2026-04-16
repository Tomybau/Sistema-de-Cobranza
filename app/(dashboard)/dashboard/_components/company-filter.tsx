"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Building } from "lucide-react"

interface CompanyFilterProps {
  companies: { id: string; name: string }[]
}

export function CompanyFilter({ companies }: CompanyFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentCompanyId = searchParams.get("companyId") || "all"

  const handleValueChange = (value: string | null) => {
    if (!value) return
    const params = new URLSearchParams(searchParams)
    if (value === "all") {
      params.delete("companyId")
    } else {
      params.set("companyId", value)
    }
    // router.push with the new search param without losing path
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 hidden sm:flex">
        <Building className="h-4 w-4" />
        Filtro global:
      </div>
      <Select value={currentCompanyId} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Todas las empresas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las empresas</SelectItem>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
