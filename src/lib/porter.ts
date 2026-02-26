// Porter orchestration logic
import { getAllAgentDefinitions, type AgentDefinition } from './db';

interface PorterMatch {
  agentId: string;
  score: number;
  matchedRules: string[];
}

/**
 * Porter analyzes task title/description and finds the best agent match
 * based on each agent's handoff_rules.
 */
export function assignAgentByPorter(taskTitle: string, taskDescription?: string): string {
  const agents = getAllAgentDefinitions().filter(agent => {
    // Only consider enabled agents
    return agent.enabled;
  });

  if (agents.length === 0) {
    return 'developer'; // fallback
  }

  const text = `${taskTitle} ${taskDescription || ''}`.toLowerCase();
  const matches: PorterMatch[] = [];

  for (const agent of agents) {
    const handoffRules = JSON.parse(agent.handoff_rules || '[]') as string[];
    if (handoffRules.length === 0) continue;

    let score = 0;
    const matchedRules: string[] = [];

    for (const rule of handoffRules) {
      const ruleText = rule.toLowerCase().trim();
      if (!ruleText) continue;

      // Check if rule matches the text
      if (text.includes(ruleText)) {
        // Longer rules get higher scores (more specific matches)
        const ruleScore = ruleText.length;
        score += ruleScore;
        matchedRules.push(rule);
      }
    }

    if (score > 0) {
      matches.push({
        agentId: agent.id,
        score,
        matchedRules,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  // Return the best match, or fallback to developer
  return matches.length > 0 ? matches[0].agentId : 'developer';
}

/**
 * Get Porter match details for debugging/display
 */
export function getPorterAnalysis(taskTitle: string, taskDescription?: string): {
  assignedAgent: string;
  matches: PorterMatch[];
  reasoning: string;
} {
  const agents = getAllAgentDefinitions().filter(agent => {
    return agent.enabled; // Only enabled agents
  });

  const text = `${taskTitle} ${taskDescription || ''}`.toLowerCase();
  const matches: PorterMatch[] = [];

  for (const agent of agents) {
    const handoffRules = JSON.parse(agent.handoff_rules || '[]') as string[];
    if (handoffRules.length === 0) continue;

    let score = 0;
    const matchedRules: string[] = [];

    for (const rule of handoffRules) {
      const ruleText = rule.toLowerCase().trim();
      if (!ruleText) continue;

      if (text.includes(ruleText)) {
        const ruleScore = ruleText.length;
        score += ruleScore;
        matchedRules.push(rule);
      }
    }

    if (score > 0) {
      matches.push({
        agentId: agent.id,
        score,
        matchedRules,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  const assignedAgent = matches.length > 0 ? matches[0].agentId : 'developer';

  let reasoning: string;
  if (matches.length === 0) {
    reasoning = 'No handoff rules matched. Defaulting to Developer Agent.';
  } else {
    const topMatch = matches[0];
    const agentName = agents.find(a => a.id === topMatch.agentId)?.name || topMatch.agentId;
    reasoning = `Assigned to ${agentName} (score: ${topMatch.score}) based on rules: ${topMatch.matchedRules.join(', ')}`;
  }

  return {
    assignedAgent,
    matches,
    reasoning,
  };
}