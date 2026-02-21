# Example transcripts

These are sample business working session transcripts that you can import
with the **ORM: Import Transcript** command.

| File | Domain | What it covers |
|------|--------|---------------|
| `transcripts/order-management.md` | E-commerce | Customers, orders, products, statuses, terminology ambiguity |
| `transcripts/university-enrollment.md` | Education | Students, courses, offerings, semesters, grades, enrollment constraints |
| `transcripts/clinic-appointments.md` | Healthcare | Patients, doctors, appointments, time slots, rooms, specialties |

## How to use

1. Open the `fregma/fregma` folder in VS Code.
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **ORM: Import Transcript**.
4. Select one of the transcript files from `examples/transcripts/`.
5. Give the model a name (or accept the default).
6. The LLM extracts object types, fact types, and constraints into a `.orm.yaml` file.

## Writing your own transcripts

A good transcript is a natural conversation between a facilitator and one or
more domain experts. The LLM looks for:

- **Business objects** and how they are identified ("each customer has a unique customer ID")
- **Relationships** between objects ("a customer places an order")
- **Constraints** on those relationships ("every order must have exactly one customer")
- **Enumerated values** ("status can be: pending, confirmed, shipped, delivered")
- **Ambiguities** worth flagging ("the billing team calls them clients")

Plain `.md` or `.txt` files work. No special formatting is required -- just
dialogue with enough detail for the modeler to extract structure.
