Facilitator: Let's map out how your library system works -- members, materials, loans, and so on.

Head Librarian: Sure. We track patrons -- some staff call them "borrowers" or "members," but it's all the same concept. Each patron is identified by a library card number. We record their full name and date of birth.

Facilitator: How do you contact patrons?

Head Librarian: Every patron must have at least one way to reach them -- either a phone number or an email address, or both. We can't have a patron with no contact information at all.

Facilitator: Tell me about the materials in your collection.

Head Librarian: We have two broad categories: books and periodicals. Every item in our catalog is one or the other, never both. Books are identified by an ISBN. Periodicals are identified by an ISSN. But regardless of type, every catalog item has a title and a publication year. The publication year must be between 1450 and 2030.

Facilitator: How are copies tracked?

Head Librarian: A single catalog item can have multiple physical copies. Each copy is identified by the combination of its catalog item and a copy number -- so copy 1 of ISBN 978-0-13-468599-1 is a different thing from copy 2 of that same book. Each copy has a condition rating: excellent, good, fair, or poor.

Facilitator: Tell me about authors and how they relate to books.

Head Librarian: Each book has one or more authors. An author is identified by an author ID. We record the author's name. An author can write many books, and a book can have multiple authors. For each book-author pairing, we track the author's position -- first author, second author, and so on. The position is a whole number starting at 1.

Facilitator: Do periodicals have authors?

Head Librarian: No, periodicals don't have individual authors in our system. They have a publisher instead. Each periodical is published by exactly one publisher, and a publisher can publish many periodicals. A publisher is identified by a publisher ID and has a name.

Facilitator: Now tell me about loans.

Head Librarian: A loan is what happens when a patron borrows a specific copy. We think of the loan as a thing in itself -- it's the event of a patron checking out a copy. Each loan gets a loan ID. A loan has a checkout date, a due date, and optionally a return date. Active loans don't have a return date yet. The loan period is either 7, 14, 21, or 28 days.

Facilitator: Are there limits on borrowing?

Head Librarian: Yes. A patron can have at most five active loans at any time. An active loan is one without a return date. And a specific copy can only be on one active loan at a time -- you can't lend out a copy that's already checked out.

Facilitator: What about overdue items?

Head Librarian: When a loan is overdue -- meaning the current date is past the due date and there's no return date -- we assess a fine. A fine is identified by a fine ID. Each fine is associated with exactly one loan, and a loan can have at most one fine. The fine has an amount in dollars and a paid status -- either paid or unpaid.

Facilitator: Tell me about reservations.

Head Librarian: A patron can reserve a catalog item -- not a specific copy, but the item in general. We track when the reservation was placed and assign a queue position. The queue position is a whole number starting at 1. A patron can reserve at most three items at a time. And a patron cannot reserve an item they currently have checked out.

Facilitator: Are there categories for organizing the collection?

Head Librarian: Yes. We have subject categories -- like "Fiction", "Science", "History", and so on. Each category has a category code and a name. Categories form a hierarchy -- a category can have a parent category. For example, "Organic Chemistry" is under "Chemistry" which is under "Science". A category cannot be its own parent, and the hierarchy must not have cycles -- you can't have A under B under C under A.

Facilitator: Can items be in multiple categories?

Head Librarian: Yes. A catalog item can belong to multiple subject categories, and a category can contain many items. Every catalog item must belong to at least one category.

Facilitator: Are there different types of patrons?

Head Librarian: We distinguish between adult patrons and juvenile patrons. Every patron is one or the other. Adult patrons can borrow any material. Juvenile patrons have a guardian, who must be an adult patron. Every juvenile patron must have exactly one guardian. A guardian can be responsible for multiple juveniles. Juvenile patrons cannot borrow materials with a "restricted" flag.

Facilitator: Is there anything about how books relate to each other?

Head Librarian: Yes, we track prerequisites for academic texts. Some books require that you've read another book first -- like "Advanced Calculus" requires "Introduction to Calculus." A book cannot be a prerequisite of itself, and the prerequisite chain cannot be circular. If A requires B and B requires C, then C cannot require A.

Facilitator: Any special rules about the catalog?

Head Librarian: One important rule: the title and publication year together must uniquely identify a catalog item. We don't allow two different catalog items with the same title published in the same year. Also, every catalog item must have at least one physical copy in the system -- we don't keep records for items we don't actually have.
