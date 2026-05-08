# Teacher AI Flow Grounding

Sources reviewed:
- `/Users/bashybaranaba/Desktop/Õpetaja juhendmaterjal_pdf.pdf`
- `/Users/bashybaranaba/Desktop/Õpetaja juhendmaterjal_II.pdf`
- `/Users/bashybaranaba/Desktop/Implementing Number Talks in Classrooms.pdf`

## Product Direction

The main flow should feel like a Number Talk planning partner, not a general chatbot. A teacher should be able to describe a class situation, a student strategy, or a desired topic and get a response that helps them run a short discussion where mathematical thinking becomes visible.

The workbook framing emphasizes:
- number sense as noticing relationships, estimating, choosing flexible strategies, and justifying choices;
- discussion as more than answer sharing: students compare, explain, listen, and refine mathematical language;
- tasks shown one at a time, followed by possible strategies, while leaving room for unexpected student approaches;
- teacher support through quick task fit, guiding questions, strategy anticipation, and classroom discussion moves.

The Number Talks classroom research adds:
- routines work best when they are explicit, short, regular, and structured;
- a respectful classroom norm matters because multiple answers and strategies are shared publicly;
- teachers should record both answers and step-by-step thinking, making strategies visible;
- discussion supports flexibility, accuracy, confidence, and fluency better than isolated memorization alone.

## Rule-Based vs AI-Based Split

Use rule-based systems where correctness and visual precision matter:
- selecting workbook tasks by metadata and embeddings;
- citing workbook part, page, task, strategy, and known misconceptions;
- displaying task and strategy images from verified workbook assets;
- generating visual representations with deterministic renderers when the visual encodes mathematics, for example number lines, arrays, fraction bars, place-value decompositions, dot patterns, or grouped objects;
- validating generated tasks against operation, grade band, answer, and strategy constraints.

Use AI where language flexibility and teacher adaptation matter:
- explaining likely student strategies in teacher-friendly language;
- diagnosing a photographed student solution against known strategies and misconceptions;
- turning a task into discussion questions, board-recording moves, and follow-up prompts;
- generating new text-only similar tasks after a verified workbook task has been selected;
- adapting tone and language between Estonian and English.

Do not use unconstrained image generation for strategy visuals that must be mathematically exact. Generated images can be decorative only, and the current app should prefer workbook source crops or deterministic math renderers.

## Response Shape

AI responses should usually follow this shape:
1. Give the teacher a concrete next move.
2. Name the workbook context when available.
3. Identify likely strategies or misconceptions.
4. Offer 2-3 guiding questions that invite explanation, comparison, and justification.
5. Suggest how to record student thinking visibly on the board.

Keep the UI quiet and focused: prompt first, context beside it, workbook as reference, and source images shown as evidence rather than decoration.
