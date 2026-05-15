import { match, normalize, jaroWinkler } from "./services/matcher.ts";

console.log("Normalization check:");
console.log("'Email Address' ->", normalize("Email Address"));
console.log("'first-name' ->", normalize("first-name"));
console.log("'last__name' ->", normalize("last__name"));

console.log("\nMatching check:");
console.log("Exact:", match("email", ["email", "name"]));
console.log("Normalized:", match("First Name", ["first_name", "last_name"]));
console.log("Fuzzy (phone_number):", match("phonenumber", ["phone_number", "email"]));
console.log("No match:", match("something", ["email", "name"]));
console.log("Ambiguity:", match("test", ["test1", "test2"]));
