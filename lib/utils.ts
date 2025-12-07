import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { Seniority } from "@/types/jd";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatJDText(sections: {
  job_title: string;
  summary: string;
  key_responsibilities: string[];
  required_skills: string[];
  preferred_skills: string[];
  behavioral_competencies: string[];
  about_company: string;
  diversity_statement: string;
}): string {
  let text = `${sections.job_title}\n\n`;
  text += `Job Summary\n${sections.summary}\n\n`;
  text += `About Trianz\n${sections.about_company}\n\n`;
  text += `Key Responsibilities\n${sections.key_responsibilities.map(r => `• ${r}`).join('\n')}\n\n`;
  text += `Required Skills & Qualifications\n${sections.required_skills.map(s => `• ${s}`).join('\n')}\n\n`;
  text += `Preferred Skills\n${sections.preferred_skills.map(s => `• ${s}`).join('\n')}\n\n`;
  text += `Behavioral Competencies\n${sections.behavioral_competencies.map(c => `• ${c}`).join('\n')}\n\n`;
  text += `Diversity & Inclusion Statement\n${sections.diversity_statement}`;
  return text;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function detectSeniorityFromTitle(jobTitle: string): Seniority {
  const title = jobTitle.toLowerCase();
  
  // Director+ level keywords
  if (
    title.includes('director') ||
    title.includes('vp') ||
    title.includes('vice president') ||
    title.includes('chief') ||
    title.includes('cfo') ||
    title.includes('cto') ||
    title.includes('ceo') ||
    title.includes('head of') ||
    title.includes('executive')
  ) {
    return 'director+';
  }
  
  // Lead level keywords
  if (
    title.includes('lead') ||
    title.includes('principal') ||
    title.includes('architect') ||
    title.includes('manager') ||
    title.includes('head')
  ) {
    return 'lead';
  }
  
  // Senior level keywords
  if (
    title.includes('senior') ||
    title.includes('sr.') ||
    title.includes('sr ') ||
    title.includes('staff') ||
    title.includes('specialist')
  ) {
    return 'senior';
  }
  
  // Junior level keywords
  if (
    title.includes('junior') ||
    title.includes('jr.') ||
    title.includes('jr ') ||
    title.includes('intern') ||
    title.includes('entry') ||
    title.includes('associate') ||
    title.includes('assistant')
  ) {
    return 'junior';
  }
  
  // Default to mid-level if no keywords found
  return 'mid';
}
