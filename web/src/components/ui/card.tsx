import * as React from "react"
import { cn } from "@/lib/utils"
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-white dark:bg-[#000319] border border-slate-200 dark:border-slate-900/60 text-slate-900 dark:text-white flex flex-col rounded-2xl shadow-sm overflow-hidden transition-colors duration-200",
              className
          )}
          {...props}
      />
  )
}
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-col gap-1.5 p-5 sm:p-6 pb-2 bg-transparent",
        className
      )}
      {...props}
    />
  )
}
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-xl font-bold tracking-tight text-slate-800 dark:text-white leading-tight", className)}
      {...props}
    />
  )
}
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-slate-400 dark:text-slate-400 text-sm font-medium leading-relaxed", className)}
      {...props}
    />
  )
}
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "ml-auto flex items-center gap-2",
        className
      )}
      {...props}
    />
  )
}
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-5 sm:px-6 pb-5 sm:pb-6 pt-2 space-y-4", className)}
      {...props}
    />
  )
}
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-5 sm:px-6 py-4 bg-slate-50 dark:bg-[#000319] border-t border-slate-100 dark:border-slate-900/40", className)}
      {...props}
    />
  )
}
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
