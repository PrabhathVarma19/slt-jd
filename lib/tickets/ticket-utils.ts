/**
 * Ticket Utilities
 * Helper functions for ticket creation, numbering, and management
 */

import { prisma } from '@/lib/prisma';
import { supabaseServer } from '@/lib/supabase/server';

export type TicketType = 'IT' | 'TRAVEL';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_REQUESTER' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Generate next ticket number (e.g., IT-000123, TR-000123)
 */
export async function generateTicketNumber(type: TicketType): Promise<string> {
  const prefix = type === 'IT' ? 'IT' : 'TR';
  
  try {
    if (prisma) {
      // Find the highest ticket number for this type
      const lastTicket = await prisma.ticket.findFirst({
        where: {
          ticketNumber: {
            startsWith: prefix,
          },
        },
        orderBy: {
          ticketNumber: 'desc',
        },
      });

      if (!lastTicket) {
        return `${prefix}-000001`;
      }

      // Extract number from ticket number (e.g., "IT-000123" -> 123)
      const match = lastTicket.ticketNumber.match(/\d+$/);
      const lastNumber = match ? parseInt(match[0], 10) : 0;
      const nextNumber = lastNumber + 1;

      // Format with leading zeros (6 digits)
      return `${prefix}-${nextNumber.toString().padStart(6, '0')}`;
    } else {
      // Use Supabase
      const { data: lastTicket } = await supabaseServer
        .from('Ticket')
        .select('ticketNumber')
        .like('ticketNumber', `${prefix}-%`)
        .order('ticketNumber', { ascending: false })
        .limit(1)
        .single();

      if (!lastTicket) {
        return `${prefix}-000001`;
      }

      const match = lastTicket.ticketNumber.match(/\d+$/);
      const lastNumber = match ? parseInt(match[0], 10) : 0;
      const nextNumber = lastNumber + 1;

      return `${prefix}-${nextNumber.toString().padStart(6, '0')}`;
    }
  } catch (error) {
    console.error('Error generating ticket number:', error);
    // Fallback: use timestamp-based number
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  }
}

/**
 * Create a ticket event for audit trail
 */
export async function createTicketEvent(
  ticketId: string,
  type: 'CREATED' | 'ASSIGNED' | 'STATUS_CHANGED' | 'PRIORITY_CHANGED' | 'NOTE_ADDED' | 'APPROVAL_REQUESTED' | 'APPROVED' | 'REJECTED',
  createdBy: string,
  payload?: any
): Promise<void> {
  try {
    if (prisma) {
      await prisma.ticketEvent.create({
        data: {
          ticketId,
          type,
          createdBy,
          payload: payload || {},
        },
      });
    } else {
      await supabaseServer
        .from('TicketEvent')
        .insert({
          ticketId,
          type,
          createdBy,
          payload: payload || {},
        });
    }
  } catch (error) {
    console.error('Error creating ticket event:', error);
    // Don't throw - event creation failure shouldn't break ticket creation
  }
}

/**
 * Create a ticket in the database
 */
export interface CreateTicketInput {
  type: TicketType;
  requesterId: string;
  title: string;
  description: string;
  category?: string;
  subcategory?: string;
  priority?: TicketPriority;
  impact?: string;
  domain?: string;
}

export async function createTicket(
  input: CreateTicketInput,
  createdBy: string
): Promise<{ id: string; ticketNumber: string }> {
  const ticketNumber = await generateTicketNumber(input.type);
  const priority = input.priority || 'MEDIUM';
  const domain = input.domain || input.type;

  try {
    if (prisma) {
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          type: input.type,
          requesterId: input.requesterId,
          title: input.title,
          description: input.description,
          category: input.category,
          subcategory: input.subcategory,
          priority,
          impact: input.impact,
          status: 'OPEN',
          domain,
        },
      });

      // Create CREATED event
      await createTicketEvent(ticket.id, 'CREATED', createdBy, {
        ticketNumber,
        type: input.type,
      });

      return {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
      };
    } else {
      // Use Supabase
      const { data: ticket, error } = await supabaseServer
        .from('Ticket')
        .insert({
          ticketNumber,
          type: input.type,
          requesterId: input.requesterId,
          title: input.title,
          description: input.description,
          category: input.category,
          subcategory: input.subcategory,
          priority,
          impact: input.impact,
          status: 'OPEN',
          domain,
        })
        .select('id, ticketNumber')
        .single();

      if (error || !ticket) {
        throw new Error(error?.message || 'Failed to create ticket');
      }

      // Create CREATED event
      await createTicketEvent(ticket.id, 'CREATED', createdBy, {
        ticketNumber,
        type: input.type,
      });

      return {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
      };
    }
  } catch (error: any) {
    console.error('Error creating ticket:', error);
    throw new Error(`Failed to create ticket: ${error.message}`);
  }
}


