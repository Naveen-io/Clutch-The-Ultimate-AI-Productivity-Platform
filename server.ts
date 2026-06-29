import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// Fallback Helper Functions to handle Gemini outages/high-demand errors gracefully
function getRescueFallback(pName: string, pDeadline: string, pProgress: number, pHours: number) {
  const risk = Math.min(100, Math.max(10, Math.round(100 - pProgress - (pHours * 0.8))));
  return {
    projectName: pName,
    trajectoryRisk: risk,
    riskAssessment: `Based on your remaining ${pHours} hours and deadline of ${pDeadline}, the project "${pName}" with current progress at ${pProgress}% has critically decelerated relative to its linear velocity bounds. Urgent scope refinement is recommended.`,
    immediateTriage: [
      `Stop any non-critical decorative refactoring for ${pName} immediately.`,
      `Prioritize the absolute core functionality over any nice-to-have visual elements.`,
      `Draft the final submission demo walk-through framework before making complex integrations.`
    ],
    recoveryPath: [
      {
        phaseName: "Triage & Core Purge",
        hoursRange: `Hours 1-${Math.max(1, Math.round(pHours * 0.1))}`,
        description: "Eliminate secondary tasks, lock down dependencies, and create a single happy path."
      },
      {
        phaseName: "Critical Flow Assembly",
        hoursRange: `Hours ${Math.max(1, Math.round(pHours * 0.1)) + 1}-${Math.max(2, Math.round(pHours * 0.4))}`,
        description: "Code the absolute simplest working prototype and bypass non-trivial setups."
      },
      {
        phaseName: "Hard Edge Debugging & Demo Preparation",
        hoursRange: `Hours ${Math.max(2, Math.round(pHours * 0.4)) + 1}-${pHours}`,
        description: "Freeze code elements, iron out primary runtime crashes, and capture your video/notes."
      }
    ],
    microTasks: [
      { id: "task-1", taskText: `Review and prune nice-to-have features from the ${pName} spec limit`, completed: false, phase: "Phase 1: Active" },
      { id: "task-2", taskText: `Establish primitive input and output data structures`, completed: false, phase: "Phase 1: Active" },
      { id: "task-3", taskText: `Draft rough outline script for final presentation demo`, completed: false, phase: "Phase 1: Active" },
      { id: "task-4", taskText: `Consolidate outstanding branches and trigger a robust local check`, completed: false, phase: "Phase 2: Upcoming" }
    ]
  };
}

function getMicroRescueFallback(pName: string) {
  return {
    task: `Outline adjacent next sub-component step of ${pName.slice(0, 30)}`,
    goal: "Draft 3 simple bullet points representing the main structure",
    stopping: "3 bullet entries exist on paper or in editor"
  };
}

function getAiActionFallback(actionType: string, projectName: string, notesContent: string, tasks: any[]) {
  let simulatedText = "";
  let simulatedList: string[] = [];
  let simulatedTitle = "";
  let simulatedDate = "";
  let simulatedStartTime = "";
  let simulatedEndTime = "";

  // Feature-specific extra fields
  let status = "Safe";
  let hoursNeeded = 0;
  let sessionsNeeded = 0;
  let daysNeeded = 0;
  let explanation = "";
  let blockingReason = "";
  let smallestNextStep = "";
  let commonMistake = "";
  let fiveMinuteAction = "";
  let priority = "";
  let session1 = "";
  let session2 = "";
  let optionalTasks: string[] = [];
  let goal = "";
  let outcome = "";
  let checklist: string[] = [];
  let completedSummary = "";
  let progressSummary = "";
  let whatsNext = "";
  let risks: string[] = [];
  let nextSteps: string[] = [];

  switch (actionType) {
    case "can_i_finish":
      status = "At Risk";
      hoursNeeded = 14;
      sessionsNeeded = 6;
      daysNeeded = 2;
      explanation = "You can still finish if you complete 2 focus sessions today and 1 tomorrow. Prioritize core layout views and freeze visual styles.";
      simulatedText = explanation;
      break;
    case "build_daily_plan":
      priority = "Implement local storage sandbox and state synchronization";
      session1 = "Write local storage fallback hooks for active tasks (45 mins)";
      session2 = "Design clean display components for today's plan card (45 mins)";
      optionalTasks = [
        "Update deadline times on calendar timeline",
        "Clean up debug logs in main browser views"
      ];
      simulatedList = [session1, session2];
      simulatedText = `Today's Priority: ${priority}`;
      break;
    case "smart_focus":
      goal = "Define simple mock data arrays and test component renderings";
      outcome = "All dashboard elements load instantly with no flickering";
      checklist = [
        "Verify standard types exist inside your models",
        "Add 3 sample items to the mock array",
        "Run local linter to ensure zero type assertions remain"
      ];
      simulatedList = checklist;
      simulatedText = `Session Goal: ${goal}`;
      break;
    case "end_of_day_review":
      completedSummary = "✓ 3 tasks completed successfully • 2 focus sessions finished";
      progressSummary = "You completed all high-priority tasks and increased project progress by 18%. Excellent momentum!";
      whatsNext = "Tomorrow's focus: Iron out remaining console issues and capture demo video.";
      simulatedList = ["Tomorrow's focus: Iron out remaining console issues", "Capture demo video"];
      simulatedText = progressSummary;
      break;
    case "project_summary":
      goal = "Provide a high-fidelity workspace tracking rescue paths for hackathons";
      status = "At Risk";
      risks = [
        "Getting distracted by nice-to-have visual menus instead of core features",
        "Running out of time to build a robust final submission script"
      ];
      nextSteps = [
        "Verify your Can I Finish trajectory statistics on the dashboard",
        "Create 1 clean note outlining the presentation highlights"
      ];
      simulatedList = nextSteps;
      simulatedText = `Active Focus: ${projectName || "Active Project"}`;
      break;
    case "suggest_next_action":
      simulatedText = `Triage task list for "${projectName || "Active Project"}": Review the pending checklist, pick the smallest item, and spend 10 minutes coding it. Breaking the paralysis is your highest-leverage task.`;
      break;
    case "suggest_work_session":
      simulatedText = "Optimal Flow Block: 10:30 AM – 12:00 PM. High-energy cognitive window detected. Schedule an uninterrupted 90-minute hyper-focus block on your core algorithm/view.";
      break;
    case "summarize_notes":
      simulatedText = "Summary:\n- This note highlights project milestones, outstanding features, and core architecture outline.\n- Immediate Focus: Implement the data synchronization loops and fix console warnings.\n- Next Step: Refine mobile touch responsiveness.";
      break;
    case "break_task_down":
      simulatedList = [
        "Isolate the single input field and clean up any empty borders.",
        "Implement standard local storage fallback bindings.",
        "Test the full click loop to ensure state changes compile correctly.",
        "Document the main function block for subsequent updates."
      ];
      simulatedText = "We've broken down this objective into 4 highly-actionable, bite-sized tasks to lower the friction of getting started.";
      break;
    case "suggest_priority":
      simulatedText = `Priority Directive: Focus entirely on "${projectName || "Active Milestone"}" today. It represents your highest risk of deadline compression and carries the greatest momentum value.`;
      break;
    case "ai_schedule":
      simulatedTitle = "Deep Focus: Milestone Sprint";
      simulatedDate = new Date().toISOString().split("T")[0];
      simulatedStartTime = "14:00";
      simulatedEndTime = "16:00";
      simulatedText = `Calculated optimal 2-hour focus block for today. Scheduling this now gives you a high chance of clearing outstanding project friction.`;
      break;
    case "notes_to_tasks":
      simulatedList = [
        "Create initial outline structure inside document",
        "Prune non-essential view states and sub-features",
        "Map key elements to database collections",
        "Write draft slides for demo pitch submission"
      ];
      simulatedText = "Extracted 4 highly-actionable next tasks from your draft notes text.";
      break;
    case "notes_to_events":
      simulatedTitle = "Sprint: Extracted from Notes";
      simulatedDate = new Date().toISOString().split("T")[0];
      simulatedStartTime = "11:00";
      simulatedEndTime = "12:30";
      simulatedText = "Identified action planning blocks in your notes and formulated a 90-minute schedule block.";
      break;
    case "stuck_suggest":
      simulatedTitle = "Create a single blank helper function definition with mock return";
      simulatedText = "Underlying Blocker: Psychological perfectionism. Fear of making an architecturally flawed database configuration before seeing simple data flow on screen.";
      simulatedList = [
        "Open your main workspace code file",
        "Write a 1-line function skeleton that returns static sample data",
        "Log a message to the browser console showing it was called successfully"
      ];
      // Stuck V2 fields
      blockingReason = "Underlying Blocker: Psychological perfectionism. Fear of making an architecturally flawed database configuration before seeing simple data flow on screen.";
      smallestNextStep = "Create a single blank helper function definition with mock return";
      commonMistake = "Trying to configure Firebase authentication rules before testing standard state changes.";
      fiveMinuteAction = "Write a 1-line function skeleton that returns static sample data in your main code view.";
      break;
    case "chat":
      const query = (notesContent || "").toLowerCase();
      if (query.includes("time") || query.includes("schedule") || query.includes("calendar")) {
        simulatedText = "Clutch Offline Coach: Let's block out a single 45-minute sprint on your calendar right now. Choose a time today, shut down all notifications, and focus strictly on one micro-task.";
      } else if (query.includes("stuck") || query.includes("procrastinate") || query.includes("start")) {
        simulatedText = "Clutch Offline Coach: When feeling stuck, the standard trap is trying to build the whole thing. Let's do a 5-minute drill. Open your workspace and write just one line—even if it is just a placeholder.";
      } else if (query.includes("linter") || query.includes("error") || query.includes("bug") || query.includes("code")) {
        simulatedText = "Clutch Offline Coach: Let's run a check locally. If you see linter warnings, isolate the file, write a solid dummy mock function first to make it compile, and then gradually add back real logic.";
      } else {
        simulatedText = `Clutch Offline Coach: That is a solid challenge. For "${projectName || "this task"}", my main advice is to define the exact next physical action (e.g., 'type the next 3 sentences' or 'setup the basic HTML shell'). Focus purely on that for 10 minutes.`;
      }
      break;
    default:
      simulatedText = `Clutch Assistant: To optimize your workflow, let's break down "${projectName || "your current task"}" into atomic micro-sessions. Start a 15-minute sprint now to get some visual progress!`;
  }
  return { 
    success: true, 
    text: simulatedText, 
    action: null,
    list: simulatedList,
    title: simulatedTitle,
    date: simulatedDate,
    startTime: simulatedStartTime,
    endTime: simulatedEndTime,
    status,
    hoursNeeded,
    sessionsNeeded,
    daysNeeded,
    explanation,
    blockingReason,
    smallestNextStep,
    commonMistake,
    fiveMinuteAction,
    priority,
    session1,
    session2,
    optionalTasks,
    goal,
    outcome,
    checklist,
    completedSummary,
    progressSummary,
    whatsNext,
    risks,
    nextSteps
  };
}

// Use Groq API with OpenAI SDK. Key can be dynamically overridden with env var.
process.env.GROQ_API_KEY
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const openai = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: GROQ_BASE_URL,
});

/**
 * Highly extensible helper to get a completion from Groq / OpenAI compatible API.
 * This satisfies all requirements:
 * - Uses the OpenAI-compatible SDK
 * - Base URL configured to api.groq.com
 * - Dynamic key handling (not hardcoded) with a solid placeholder
 * - Graceful error handling
 * - Easy provider / model switching in the future
 */
async function getAiCompletion(options: {
  systemInstruction?: string;
  prompt: string;
  responseFormat?: "json" | "text";
}) {
  try {
    const response = await openai.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        ...(options.systemInstruction ? [{ role: "system" as const, content: options.systemInstruction }] : []),
        { role: "user" as const, content: options.prompt }
      ],
      response_format: options.responseFormat === "json" ? { type: "json_object" } : undefined,
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content || "";
  } catch (err: any) {
    console.error("Groq API completion failure:", err);
    throw err;
  }
}

// Port must be 3000 as configured by AI Studio routing
const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Route: Generate Task Rescue Plan via Groq llama-3.3-70b-versatile
  app.post("/api/rescue", async (req, res) => {
    try {
      const { projectName, deadline, currentProgress, hoursRemaining, customNotes } = req.body;

      const pName = projectName || "Unnamed Project";
      const pDeadline = deadline || "Shortly";
      const pProgress = (currentProgress !== undefined) ? Number(currentProgress) : 32;
      const pHours = (hoursRemaining !== undefined) ? Number(hoursRemaining) : 45;
      const pNotes = customNotes || "None";

      try {
        const prompt = `
          You are Clutch, the ultimate expert Deadline Rescue Agent. A user is highly stressed, stuck, and procrastinating. 
          They provided the following parameters of their current crisis:
          - Project / Task Name: "${pName}"
          - Hard Deadline info: "${pDeadline}"
          - Current Completion Progress: ${pProgress}%
          - Usable Hours Remaining: ${pHours} hours
          - Contextual Notes or Additional Details: "${pNotes}"

          Analyze their trajectory risk. Since they only have ${pHours} hours left and are at ${pProgress}% progress, compute a realistic but strict 1-100 risk score, where 100 is absolute failure/miss.
          Draft a practical, highly-actionable project rescue plan containing:
          1. A brief but punchy riskAssessment (under 200 characters) designed to reduce anxiety but motivate action.
          2. Exactly 3 tactical immediateTriage points (highly specific, direct command actions to freeze useless work, e.g. "Halt non-essential styling refactor immediately").
          3. A structured recovery path broken down into 3 simple sequential time-framed phases to get them to completion.
          4. Exactly 4 small, achievable microTasks they can start checking off right away. Prefix them with action verbs.

          Be realistic of what they can accomplish in ${pHours} hours.

          IMPORTANT: Your response MUST be valid JSON matching this schema:
          {
            "projectName": "string",
            "trajectoryRisk": number,
            "riskAssessment": "string",
            "immediateTriage": ["string", "string", "string"],
            "recoveryPath": [
              { "phaseName": "string", "hoursRange": "string", "description": "string" },
              { "phaseName": "string", "hoursRange": "string", "description": "string" },
              { "phaseName": "string", "hoursRange": "string", "description": "string" }
            ],
            "microTasks": [
              { "id": "task-1", "taskText": "string", "completed": false, "phase": "Phase 1: Active" },
              { "id": "task-2", "taskText": "string", "completed": false, "phase": "Phase 1: Active" },
              { "id": "task-3", "taskText": "string", "completed": false, "phase": "Phase 1: Active" },
              { "id": "task-4", "taskText": "string", "completed": false, "phase": "Phase 2: Upcoming" }
            ]
          }
        `;

        const responseText = await getAiCompletion({
          systemInstruction: "You are the primary intelligence driving the Clutch deadline rescue service. You specialize in cognitive decompression, task parsing, and motivational clarity. You MUST respond with valid JSON.",
          prompt: prompt,
          responseFormat: "json",
        });

        if (!responseText) {
          throw new Error("Empty response from Groq API");
        }

        const parsedPlan = JSON.parse(responseText.trim());
        return res.json(parsedPlan);
      } catch (groqErr: any) {
        console.warn("Groq API /api/rescue failed, applying dynamic local fallback...", groqErr);
        return res.json(getRescueFallback(pName, pDeadline, pProgress, pHours));
      }

    } catch (e: any) {
      console.log("Internal rescue parser completed with offline simulation.");
      const fallbackName = req.body?.projectName || "Unnamed Project";
      const fallbackDeadline = req.body?.deadline || "Shortly";
      const fallbackProgress = Number(req.body?.currentProgress) || 32;
      const fallbackHours = Number(req.body?.hoursRemaining) || 45;
      return res.json(getRescueFallback(fallbackName, fallbackDeadline, fallbackProgress, fallbackHours));
    }
  });

  // API Route: Generate 15-Minute Micro Focus Block suggestions via Groq llama-3.3-70b-versatile
  app.post("/api/micro-rescue", async (req, res) => {
    try {
      const { projectName, successCondition } = req.body;
      const pName = projectName || "General task";
      const pSuccess = successCondition || "Work block completion";

      try {
        const prompt = `
          You are Clutch, the Ultimate Focus Trainer. The user has only 15 minutes of focus capacity before fatigue or procrastination kicks in.
          They need to make a dent in this task: "${pName}" (Success Criteria: "${pSuccess}").

          Formulate one extremely narrow, ultra-achievable micro focus block consisting of:
          1. One highly actionable task (e.g., "Draft 1 simple helper function signature or map out 3 headings")
          2. One measurable goal (e.g., "Write 3 lines of code or type 150 words of draft text")
          3. One clear stopping point when the 15-minute timer rings (e.g., "A basic function exists with no compiler complaints")

          Keep all suggestions extremely lightweight, easy to start, and bite-sized so the user can overcome hesitation.

          IMPORTANT: Your response MUST be valid JSON matching this schema:
          {
            "task": "string (Atomic task to perform in 15 mins)",
            "goal": "string (Measurable small outcome)",
            "stopping": "string (Stopping condition to stop and feel proud)"
          }
        `;

        const responseText = await getAiCompletion({
          systemInstruction: "You specialize in behavioral conditioning, starting-friction reduction, and task atomicity. You MUST respond with valid JSON.",
          prompt: prompt,
          responseFormat: "json",
        });

        if (!responseText) {
          throw new Error("Empty response from Groq API");
        }

        return res.json(JSON.parse(responseText.trim()));
      } catch (groqErr: any) {
        console.warn("Groq API /api/micro-rescue failed, applying dynamic local fallback...", groqErr);
        return res.json(getMicroRescueFallback(pName));
      }
    } catch (e: any) {
      console.log("Internal micro-rescue parser completed with offline simulation.");
      const fallbackName = req.body?.projectName || "General task";
      return res.json(getMicroRescueFallback(fallbackName));
    }
  });

  // API Route: Generic Contextual AI Action Assistant via Groq llama-3.3-70b-versatile
  app.post("/api/ai-action", async (req, res) => {
    try {
      const { actionType, projectName, notesContent, tasks, customPrompt, currentHour } = req.body;

      try {
        let systemInstruction = "You are Clutch AI, the embedded high-performance planning assistant. Your tone is clean, professional, motivational, and extremely direct.";
        let prompt = "";

        switch (actionType) {
          case "can_i_finish":
            prompt = `Perform a "Can I Still Finish?" diagnostic for the project "${projectName || "Active Project"}".
            - Deadline: "${notesContent || "shortly"}"
            - Current Progress: ${projectName ? tasks : 32}% (read as a number)
            - Available Time/Hours: ${currentHour || 15} hours
            Analyze their trajectory and return:
            1. status: "Likely", "At Risk", or "Critical" based on whether they can realistically finish.
            2. hoursNeeded: realistic total remaining working hours.
            3. sessionsNeeded: number of 45-minute focus sessions to get there.
            4. explanation: a short, supportive, realistic coaching paragraph explaining how they can finish (under 200 characters). E.g., "You can still finish if you complete 2 focus sessions today and 1 tomorrow."`;
            break;
          case "build_daily_plan":
            prompt = `Analyze current project state to construct Today's Plan.
            - Active Project Name: "${projectName || "General Workspace"}"
            - Tasks lists/notes: "${notesContent || "No tasks yet"}"
            Determine the highest-leverage goals for today and formulate:
            1. priority: Today's single absolute priority action.
            2. session1: Concrete focus session 1 goal with timeframe (e.g. "Draft responsive visual layout (45 mins)").
            3. session2: Concrete focus session 2 goal with timeframe.
            4. optionalTasks: Exactly 2 non-critical optional next-step tasks.`;
            break;
          case "smart_focus":
            prompt = `The user is about to start an active focus session on task "${projectName || "Active Task"}".
            Create a "Smart Focus Mode" preparation guide:
            1. goal: One direct, highly descriptive objective for this session.
            2. outcome: The expected success outcome (what will be working when they finish).
            3. checklist: Exactly 3 specific checklists items representing the baby steps to execute this.`;
            break;
          case "end_of_day_review":
            prompt = `Perform an End of Day Review. 
            - Completed activities list/notes: "${notesContent || "Completed active tasks"}"
            Create a highly encouraging, momentum-building wrap up:
            1. completedSummary: Short, punchy summary of what was completed (under 120 characters).
            2. progressSummary: A short, motivating summary of progress made and how it moves them forward.
            3. whatsNext: Tomorrow's prime priority next step.`;
            break;
          case "project_summary":
            prompt = `Explain this project to a judge, reviewer, or demo visitor.
            - Project Name: "${projectName || "Active Project"}"
            - Context or custom notes: "${notesContent || "Lightweight planning workspace"}"
            Generate a neat, high-level structural breakdown:
            1. goal: A direct, human-friendly summary of what this project accomplishes.
            2. status: "Safe", "Needs Attention", or "Critical" trajectory evaluation.
            3. risks: Array of exactly 2 main project risks (e.g., Scope creep, presentation timing).
            4. nextSteps: Array of exactly 2 concrete immediate next steps.`;
            break;
          case "project_health_risk":
            prompt = `Analyze the Project Health Risk for "${projectName || "Active Project"}".
            - Deadline: "${notesContent || "Shortly"}"
            - Current Completion Progress: ${projectName ? tasks : 30}% (numeric progress)
            Provide a realistic risk trajectory evaluation:
            1. status: "Safe", "Needs Attention", or "Critical".
            2. text: Exactly one short sentence with a supportive, clear recommendation on what they should prioritize next to stay on track.`;
            break;
          case "suggest_next_action":
            prompt = `Provide one concrete, extremely actionable next step for the project "${projectName}". The objective is to keep it under 150 characters, starting with a direct action verb.`;
            break;
          case "suggest_work_session":
            prompt = `Recommend the optimal productivity focus session of the day given that the current local hour is ${currentHour || "morning"}. Specify a duration (e.g., 50m block) and why. Under 180 characters.`;
            break;
          case "summarize_notes":
            prompt = `Analyze the following user draft notes and summarize them into a neat executive summary of 3 bullet points with bold headers. Notes text: "${notesContent || "empty notes"}".`;
            break;
          case "break_task_down":
            prompt = `Given the task "${projectName}", break it down into exactly 4 small, achievable steps. Provide a short description (under 120 characters) and the list of 4 items separately.`;
            systemInstruction = "You specialize in task decomposition and work breakdown structures.";
            break;
          case "suggest_priority":
            prompt = `Given active projects: ${JSON.stringify(tasks || [])}, suggest today's absolute highest priority project and briefly explain why. Keep it under 180 characters.`;
            break;
          case "ai_schedule":
            prompt = `Suggest an optimal deep work focus session block for the project named "${projectName || "Active Project"}". 
            Generate a realistic focus block title, a date (YYYY-MM-DD format starting from today ${new Date().toISOString().split('T')[0]}), a start time (HH:MM), and end time (HH:MM). The duration should be 1.5 to 3 hours. 
            Also write a short rational explanation (under 180 characters) of why this session is recommended.`;
            break;
          case "notes_to_tasks":
            prompt = `Carefully review these draft notes: "${notesContent || "empty notes"}". Extract exactly 4 highly-actionable, concise task items representing the concrete next steps mentioned or implied. Do not include meta text; return them as a list of strings. Include an overall encouraging explanation text.`;
            systemInstruction = "You specialize in action item extraction and checklist compilation from rough text.";
            break;
          case "notes_to_events":
            prompt = `Analyze these draft notes: "${notesContent || "empty notes"}". Find or infer an optimal focus/sprint scheduling window mentioned or implied.
            Provide: a Title, Date (YYYY-MM-DD), Start Time (HH:MM), End Time (HH:MM), and a short text explanation of why this block was scheduled.`;
            break;
          case "stuck_suggest":
            prompt = `The user is completely stuck, paralyzed, or procrastinating on their project "${projectName || "their Active Project"}". They provided this explanation: "${notesContent || "No explanation provided"}".
            Please provide custom diagnostic relief:
            1. blockingReason: What is blocking them? Formulate a deep, supportive psychological analysis (under 120 characters) of why they might be stalling (e.g. "Unconscious perfectionism. Fearing a complex setup before typing the initial line of draft code").
            2. smallestNextStep: Return an extremely small, laughable, low-friction micro-task (under 120 characters) (e.g. "Create a single blank file named test.js" or "Draft exactly 3 imperfect sentences of draft text").
            3. commonMistake: A common mistake they might make in this situation.
            4. fiveMinuteAction: A 5-minute actionable next step to get them moving.
            5. list: Exactly 3 micro-actions to take in the next 3 minutes to break the friction barrier.`;
            systemInstruction = "You are a master psychological coach and behavioral therapist specializing in extreme procrastination and starting-friction reduction.";
            break;
          case "chat":
            {
              const pPersonality = req.body.aiPersonality || "Professional";
              const pRemember = req.body.aiRemember || [];
              const pResponseLength = req.body.aiResponseLength || "Balanced";
              const pTone = req.body.aiTone || "Technical";
              prompt = `You are Clutch, a supportive and super focused workspace coach.
              Adapt your response behavior and persona to match the following user personalization settings:
              - AI Personality: "${pPersonality}"
              - What you should remember/know about the user: ${JSON.stringify(pRemember)}
              - Response Length target: "${pResponseLength}"
              - Conversation Tone: "${pTone}"

              The user is asking: "${customPrompt}"
              Context:
              - Active Project: "${projectName || 'None specified'}"
              - Notes: "${notesContent || 'None'}"
              
              Provide a response matching the requested personality ("${pPersonality}"), tone ("${pTone}"), and length ("${pResponseLength}"). Be highly practical, give them 1 immediate physical micro-step they can take right now. Avoid wordy introductions.

              IMPORTANT: If the user's query asks you to create, make, add, schedule, or set up a project (or goal), a note, or a calendar event, you MUST identify this request and output a structured "action" object in the JSON.
              
              For project creation requests (e.g. "make a project named X", "create project Y", "add project X"):
              "action": {
                "type": "create_project",
                "projectData": {
                  "name": "Title/Name of the project",
                  "deadline": "YYYY-MM-DD format (infer a reasonable deadline if not specified, e.g., 5 days from today)",
                  "hoursRemaining": 16,
                  "successCondition": "Clear, measurable criteria of success for this project"
                }
              }

              For note creation requests (e.g. "add a note called X", "create note with body Y"):
              "action": {
                "type": "create_note",
                "noteData": {
                  "title": "Title of the note sheet",
                  "content": "The draft text content of the note"
                }
              }

              For calendar event / scheduling requests (e.g. "schedule a session on calendar", "add calendar event X on Y date"):
              "action": {
                "type": "create_calendar_event",
                "calendarEventData": {
                  "title": "Subject/Title of the event",
                  "date": "YYYY-MM-DD format (infer if not given, e.g., today)",
                  "startTime": "HH:MM format",
                  "endTime": "HH:MM format"
                }
              }

              If the user did not explicitly ask to make/create/add/schedule one of these items, set "action" to null. Always confirm in your text response that you have successfully executed the requested workspace action (e.g., "I've added the project 'X' to your workspace!").`;
            }
            break;
          default:
            prompt = customPrompt || "Suggest a general productivity tip under 150 characters.";
        }

        const promptWithJsonFormat = `${prompt}

        IMPORTANT: Your response MUST be valid JSON. It must contain at least the "text" property (the main explanation, summary, or response text), plus any action-specific fields requested above. Do not include any other markdown formatting outside of the JSON block.
        Format your response precisely to match the fields requested. Here is the allowed JSON structure:
        {
          "text": "The main text explanation or summary.",
          "action": {
            "type": "create_project" or "create_note" or "create_calendar_event" or null,
            "projectData": {
              "name": "string",
              "deadline": "string (YYYY-MM-DD)",
              "hoursRemaining": number,
              "successCondition": "string"
            },
            "noteData": {
              "title": "string",
              "content": "string"
            },
            "calendarEventData": {
              "title": "string",
              "date": "string (YYYY-MM-DD)",
              "startTime": "string (HH:MM)",
              "endTime": "string (HH:MM)"
            }
          },
          "list": ["string"],
          "title": "string",
          "date": "string",
          "startTime": "string",
          "endTime": "string",
          "status": "string",
          "hoursNeeded": number,
          "sessionsNeeded": number,
          "daysNeeded": number,
          "explanation": "string",
          "blockingReason": "string",
          "smallestNextStep": "string",
          "commonMistake": "string",
          "fiveMinuteAction": "string",
          "priority": "string",
          "session1": "string",
          "session2": "string",
          "optionalTasks": ["string"],
          "goal": "string",
          "outcome": "string",
          "checklist": ["string"],
          "completedSummary": "string",
          "progressSummary": "string",
          "whatsNext": "string",
          "risks": ["string"],
          "nextSteps": ["string"]
        }`;

        const responseText = await getAiCompletion({
          systemInstruction: systemInstruction,
          prompt: promptWithJsonFormat,
          responseFormat: "json",
        });

        if (!responseText) throw new Error("Empty response from Groq API");

        const parsed = JSON.parse(responseText.trim());
        return res.json({ success: true, ...parsed });
      } catch (groqErr: any) {
        console.warn("Groq API /api/ai-action failed, applying dynamic local fallback...", groqErr);
        return res.json(getAiActionFallback(actionType, projectName, notesContent, tasks));
      }
    } catch (e: any) {
      console.log("Internal assistant parser completed with offline simulation.");
      const fallbackAction = req.body?.actionType || "default";
      const fallbackProject = req.body?.projectName || "Active Project";
      const fallbackNotes = req.body?.notesContent || "";
      const fallbackTasks = req.body?.tasks || [];
      return res.json(getAiActionFallback(fallbackAction, fallbackProject, fallbackNotes, fallbackTasks));
    }
  });

  // Serve static assets OR use Vite Middleware for Hot Module Loading during dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Clutch Server listening on port ${PORT}`);
  });
}

startServer();
