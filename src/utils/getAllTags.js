export function getAllTags(posts) {

  const tagMap = new Map();

  posts.forEach((post) => {

    const tags =
      post.data.tags || [];

    tags.forEach((tag) => {

      if (!tagMap.has(tag)) {
        tagMap.set(tag, []);
      }

      tagMap.get(tag).push(post);

    });

  });

  return tagMap;
}

export function getTagSlug(tag) {

  return tag
    .toLowerCase()
    .trim()
    .replaceAll("/", "-")
    .replaceAll(" ", "-");

}
