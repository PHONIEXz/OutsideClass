export function matchesUpdate(post, category, query) {
  return (
    (category === "All updates" || post.category === category) &&
    post.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  );
}
