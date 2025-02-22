import { Request, Response } from 'express'
import { ContentModel } from '../schema/db/contentSchema'
import { LinkModel } from '../schema/db/linkSchema'
import { TagModel } from '../schema/db/tagSchema'
import { ContentType, generateHash } from '../utils/helper'

const contentController = {
  async create(req: Request, res: Response) {
    let { title, description, link, tags } = req.body

    if (!title && !link) {
      res.status(400).json({
        message: 'Nothing to Recall',
      })
      return
    }

    //if link is given determine the type of link
    let type
    if (link) {
      type = ContentType(link.trim())
    }

    //storing tags
    let tagIds = [] //stores ids of all tags (Created and also Already existing ones);
    if (tags && tags.length > 0) {
      tagIds = await Promise.all(
        tags.map(async (tag: string) => {
          tag = tag.trim().toLowerCase()
          let tagResponse = await TagModel.findOne({ tag })
          if (!tagResponse) {
            tagResponse = await TagModel.create({ tag })
          }
          return tagResponse._id
        })
      )
    }

    //Create the content
    try {
      const doc = await ContentModel.create({
        title,
        link,
        tags: tagIds.length > 0 ? tagIds : undefined,
        description,
        type,
        userId: req.userId,
      })

      res.status(200).json({
        message: 'Document created successfully',
        doc,
      })
    } catch (error) {
      console.error('Error creating document:', error)
      res.status(500).json({
        message: "Couldn't create document",
      })
    }
  },
  async get(req: Request, res: Response) {
    try {
      let content = await ContentModel.find({
        userId: req.userId,
      })
        .populate('userId', '-password')
        .sort({ createdAt: -1 })
      if (!content) {
        res.status(404).json({
          message: 'document does not exist',
        })
        return
      }
      res.status(200).json({
        message: 'Found the document',
        content,
      })
    } catch (error) {
      res.status(404).json({
        message: "Coulcn't get document",
      })
      return
    }
  },
  async recallChunks(req: Request, res: Response) {
    let {
      query: { page: no },
      userId,
    } = req
    const page = parseInt(no as string) // some ts error still have to study about this
    const limit = 10

    if (typeof page !== 'number' || page < 1 || !no) {
      res.status(400).json({
        message: 'Invalid page number',
      })
      return
    }

    try {
      let content = await ContentModel.find({ userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', '-password')
        .populate('tags')
      const length = content.length
      if (!content || length === 0) {
        res.status(404).json({
          message: 'document does not exist',
        })
        return
      }

      res.status(200).json({
        message: 'Found the recall',
        length,
        content,
      })
    } catch (error) {
      res.status(404).json({
        message: "Couldn't get recall",
      })
      return
    }
  },
  async delete(req: Request, res: Response) {
    const {
      body: { contentId: _id },
      userId,
    } = req
    try {
      const content = await ContentModel.deleteMany({ _id, userId })
      if (content.deletedCount <= 0) {
        res.status(404).json({
          message:
            'No recall was found to delete or you do not have permission',
        })
        return
      }
      res.status(200).json({
        message: 'deleted recall successfully',
      })
    } catch (error) {
      res.status(404).json({
        message: "Couldn't delete recall",
      })
    }
  },
  async sharedRecallStatus(req: Request, res: Response) {
    try {
      const link = await LinkModel.findOne({ userId: req.userId })
      if (!link) {
        res.status(404).json({
          message: 'No link found',
        })
        return
      }
      res.status(200).json({
        message: 'Found the link',
        link,
      })
    } catch (error) {
      res.status(404).json({
        message: 'No link found',
      })
    }
  },
  async share(req: Request, res: Response) {
    const {
      body: { share },
      userId,
    } = req
    try {
      if (share) {
        const prev = await LinkModel.findOne({ userId })
        if (!prev) {
          const link = await LinkModel.create({
            userId,
            hash: generateHash(10),
          })
          res.status(200).json({
            message: 'created share link',
            link,
          })
        } else {
          res.status(200).json({
            message: 'share link already exists',
            link: prev,
          })
          return
        }
      } else {
        await LinkModel.deleteOne({
          userId: req.userId,
        })
        res.status(200).json({
          message: 'deleted share link',
        })
      }
    } catch (error) {
      res.status(404).json({
        message: 'share link could not be created',
      })
    }
  },
  async search(req: Request, res: Response) {
    //search query
    const q = req.query.q as string;

    //if no search query we do early return
    if (!q) {
      res.status(400).json({ message: 'Search query is required' });
      return;
    }

    try {
      const regex = new RegExp(q, 'i'); // 'i' for case-insensitive

      const results = await ContentModel.find({
        $or: [{ title: regex }, { description: regex }, { link: regex }],
        userId: req.userId,
      })
        .sort({ createdAt: -1 })
        .populate('userId', '-password')
        .populate('tags');

      console.log(q)
      console.log(results)
      console.log(req.userId);
      res.status(200).json({ message: 'Search results', results });
      return;
    } catch (error) {
      console.error('Error searching:', error);
      res.status(500).json({ message: 'Internal server error' });
      return;
    }
  },
  async sharedRecallChunks(req: Request, res: Response) {
    let { hash } = req.params
    try {
      // first find the link in link model
      const link = await LinkModel.findOne({ hash })
      if (!link) {
        res.status(404).json({
          message: 'No link found',
        })
        return
      }

      try {
        if (!link?.userId) {
          res.status(404).json({
            message: 'No link found',
          })
          return
        }

        let {
          query: { page: no },
        } = req
        const page = parseInt(no as string)
        const limit = 10

        if (typeof page !== 'number' || page < 1 || !no) {
          res.status(400).json({
            message: 'Invalid page number',
          })
          return
        }

        //now from the link response gather the recalls of link.userId
        let content = await ContentModel.find({
          userId: link?.userId,
        })
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('userId', '-password')
          .populate('tags')
        const length = content.length
        if (!content || length === 0) {
          res.status(404).json({
            message: 'document does not exist',
          })
          return
        }
        res.status(200).json({
          message: 'Found the recall',
          length,
          content,
        })
      } catch (error) {
        res.status(404).json({
          message: "Coulcn't get recall",
        })
      }
    } catch (error) {
      res.status(404).json({
        message: 'No link found',
      })
    }
  },
  async recall(req: Request, res: Response) {
    let {
      params: { id: _id },
      userId,
    } = req
    try {
      const content = await ContentModel.findOne({ _id })
      if (content?.userId?.toString() !== userId) {
        res.status(403).json({
          message: 'You are not authorized to view this document',
        })
        return
      }

      res.status(200).json({
        message: 'Found the document',
        content,
      })
    } catch (error) {
      res.status(404).json({
        message: 'No link found',
      })
    }
  },
  async sharedRecall(req: Request, res: Response) {
    let {
      query: { link, id },
    } = req

    try {
      const linkResponse = await LinkModel.findOne({ hash: link })
      if (!linkResponse) {
        res.status(404).json({
          message: 'No link found',
        })
        return
      }

      const content = await ContentModel.findOne({ _id: id })
      if (!content) {
        res.status(404).json({
          message: 'No content found',
        })
        return
      }
      if (linkResponse.userId.toString() !== content?.userId.toString()) {
        res.status(403).json({
          message: 'You are not authorized to view this document',
        })
        return
      }

      res.status(200).json({
        message: 'Found the document',
        content,
      })
    } catch (error) {
      res.status(404).json({
        message: 'No link found',
      })
    }

  },
  async updateRecall(req: Request, res: Response) {
    let {
      params: { id: _id },
      userId,
      body: { title, description, link, tags },
    } = req;

    // Define options for findByIdAndUpdate
    const options = { new: true, runValidators: true };

    let type;
    if (link) {
      type = ContentType(link.trim());
    }

    // Store tags
    let tagIds = [];
    if (tags && tags.length > 0) {
      tagIds = await Promise.all(
        tags.map(async (tag: string) => {
          tag = tag.trim().toLowerCase();
          let tagResponse = await TagModel.findOne({ tag });
          if (!tagResponse) {
            tagResponse = await TagModel.create({ tag });
          }
          return tagResponse._id;
        })
      );
    }

    try {
      const contentt = await ContentModel.findOne({ _id })
      if (contentt?.userId?.toString() !== userId) {
        res.status(403).json({
          message: 'You are not authorized to view this document',
        })
        return
      }
      const content = await ContentModel.findByIdAndUpdate(
        _id,
        {
          title,
          description,
          link,
          tags: tagIds.length > 0 ? tagIds : undefined,
          type,
        },
        options
      );

      if (!content) {
        res.status(404).json({
          message: 'No content found',
        });
        return;
      }

      res.status(200).json({
        message: 'Content updated successfully',
        content,
      });
    } catch (error) {
      console.error('Error updating content:', error);
      res.status(500).json({
        message: "Couldn't update content",
      });
    }
  }

}

export default contentController
