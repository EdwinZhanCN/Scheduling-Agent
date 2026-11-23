# Scheduling Agent

A Fall 2026 course project for **CSCI 4150 – Introduction to Artificial Intelligence** at **Rensselaer Polytechnic Institute (RPI)**.

Scheduling Agent is a local, single-user calendar assistant. Ask it to create, move, or delete an event in English or Chinese. DeepSeek interprets the request, and scheduling rules check availability and conflicts. Calendar changes are saved to SQLite only after you approve them.

## Run locally

Requires Node.js 22.19.0 or later and pnpm. The project pins pnpm 11.7.0.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
# Set DEEPSEEK_API_KEY in .env.local before starting the app.
pnpm dev
```

Open <http://127.0.0.1:3000> and set your timezone and availability under **Preferences & availability**. Try asking:

> Schedule 45 minutes of study tomorrow, not before 14:00 and finish by 17:00.

Review the proposed event and its constraints, then select **Approve & save** to add it to the calendar.

## Development

Run `pnpm verify` for formatting, lint, type, test, and build checks. See the [validation record](docs/validation.md) for acceptance commands, results, and limits, and the [architecture guide](docs/architecture.md) for the request and approval flow.

## Acknowledgments

Our project advisor and course instructor is [Dr. Neha Keshan](https://github.com/NehaKeshan).

Thank you to teaching assistants **Anirban Acharya** and **Jade Franklin** for their support, and to our CSCI 4150 classmates for sharing feedback and ideas during studio sessions.

OpenAI Codex assisted with this README revision. The course credits were checked against the Fall 2026 syllabus.
