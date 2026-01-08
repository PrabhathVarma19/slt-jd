-- ============================================
-- ADD PENDING_APPROVAL STATUS TO TICKET TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop the existing constraint
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_status_check";

-- Add the new constraint with PENDING_APPROVAL
ALTER TABLE "Ticket" 
ADD CONSTRAINT "Ticket_status_check" 
CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'RESOLVED', 'CLOSED', 'PENDING_APPROVAL'));

-- Update any existing tickets that might need this status
-- (This is optional, only if you have existing tickets that should be PENDING_APPROVAL)

