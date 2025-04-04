const { BskyAgent } = require('@atproto/api');

class ATProtocolService {
  constructor() {
    this.agent = new BskyAgent({
      service: 'https://pds.hapa.ai'
    });
    this.currentUser = null;
  }

  async initialize() {
    // The agent will be initialized when the user signs in
    // The session is handled by the main auth process
  }

  async login(identifier, password) {
    try {
      const response = await this.agent.login({
        identifier,
        password
      });
      
      this.currentUser = response.data;
      return {
        success: true,
        user: response.data
      };
    } catch (error) {
      console.error('Error logging in:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getPosts() {
    try {
      if (!this.currentUser) {
        throw new Error('Not authenticated');
      }

      const response = await this.agent.getTimeline();
      return {
        success: true,
        posts: response.data.feed.map(post => ({
          uri: post.post.uri,
          author: {
            handle: post.post.author.handle,
            displayName: post.post.author.displayName
          },
          record: post.post.record,
          indexedAt: post.post.indexedAt,
          likeCount: post.post.likeCount,
          repostCount: post.post.repostCount,
          replyCount: post.post.replyCount,
          replies: post.replies || []
        }))
      };
    } catch (error) {
      console.error('Error fetching posts:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createPost(text) {
    try {
      if (!this.currentUser) {
        throw new Error('Not authenticated');
      }

      const response = await this.agent.post({
        text
      });
      return {
        success: true,
        post: response.data
      };
    } catch (error) {
      console.error('Error creating post:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createComment(postUri, text) {
    try {
      if (!this.currentUser) {
        throw new Error('Not authenticated');
      }

      const response = await this.agent.post({
        text,
        replyTo: postUri
      });
      return {
        success: true,
        comment: response.data
      };
    } catch (error) {
      console.error('Error creating comment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async performPostAction(postUri, action) {
    try {
      if (!this.currentUser) {
        throw new Error('Not authenticated');
      }

      let response;
      switch (action) {
        case 'like':
          response = await this.agent.like(postUri);
          break;
        case 'repost':
          response = await this.agent.repost(postUri);
          break;
        default:
          throw new Error('Invalid action');
      }
      return {
        success: true,
        result: response.data
      };
    } catch (error) {
      console.error('Error performing post action:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getPostDetail(postUri) {
    try {
      if (!this.currentUser) {
        throw new Error('Not authenticated');
      }

      const response = await this.agent.getPost(postUri);
      return {
        success: true,
        post: response.data
      };
    } catch (error) {
      console.error('Error fetching post detail:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async logout() {
    try {
      await this.agent.logout();
      this.currentUser = null;
      return {
        success: true
      };
    } catch (error) {
      console.error('Error logging out:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ATProtocolService(); 