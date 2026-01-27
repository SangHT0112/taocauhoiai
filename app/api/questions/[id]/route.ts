// app/api/questions/[id]/route.ts - VERSION FIXED
import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import jwt from "jsonwebtoken"

// IMPORTANT: Add this for dynamic routes
export const dynamic = 'force-dynamic'

// Helper để lấy params đúng cách
async function getParams(request: NextRequest): Promise<{ id: string }> {
  const url = new URL(request.url)
  const pathname = url.pathname
  const id = pathname.split('/').pop() || ''
  return { id }
}

async function getUserId(request: NextRequest): Promise<number> {
  const token = request.cookies.get("token")?.value;
  if (!token) {
    throw new Error("Unauthorized: No token");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    return decoded.userId;
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
}

export async function PUT(
  request: NextRequest
) {
  try {
    // Lấy params từ URL thay vì từ params object
    const params = await getParams(request)
    const questionId = parseInt(params.id, 10)
    
    console.log("🔍 API PUT /api/questions/[id] called:", {
      url: request.url,
      pathname: new URL(request.url).pathname,
      params,
      questionId
    })

    if (isNaN(questionId) || questionId <= 0) {
      console.error("❌ Invalid question ID:", params.id)
      return NextResponse.json({ error: `Invalid question ID: ${params.id}` }, { status: 400 })
    }

    const token = request.cookies.get("token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let userId: number
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number }
      userId = decoded.userId
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const body = await request.json()
    console.log("📥 Request body:", body)

    const { question_text, emoji, explanation, model_answer, question_type_id } = body

    // Validate at least one field is provided
    if (question_text === undefined && emoji === undefined && 
        explanation === undefined && model_answer === undefined && 
        question_type_id === undefined) {
      return NextResponse.json({ 
        error: "At least one field must be provided for update" 
      }, { status: 400 })
    }

    const connection = await pool.getConnection()
    try {
      // Check if question exists and user has permission
      console.log("🔍 Checking question ownership...", { questionId, userId })
      const [checkRows]: any = await connection.execute(
        `SELECT q.id, q.question_text, e.user_id 
         FROM questions q 
         JOIN exercises e ON q.exercise_id = e.id 
         WHERE q.id = ? AND e.user_id = ?`,
        [questionId, userId]
      )
      
      console.log("🔍 Check result:", {
        rowsFound: checkRows.length,
        questionExists: checkRows.length > 0,
        currentQuestion: checkRows[0]?.question_text,
        exerciseOwner: checkRows[0]?.user_id
      })

      if (!checkRows.length) {
        return NextResponse.json({ 
          error: `Question not found (ID: ${questionId}) or unauthorized (User: ${userId})` 
        }, { status: 404 })
      }

      // Build dynamic update query
      const updates: string[] = []
      const values: any[] = []
      
      if (question_text !== undefined) {
        updates.push("question_text = ?")
        values.push(question_text.trim())
      }
      if (emoji !== undefined) {
        updates.push("emoji = ?")
        values.push(emoji)
      }
      if (explanation !== undefined) {
        updates.push("explanation = ?")
        values.push(explanation.trim())
      }
      if (model_answer !== undefined) {
        updates.push("model_answer = ?")
        values.push(model_answer.trim())
      }
      if (question_type_id !== undefined) {
        updates.push("question_type_id = ?")
        values.push(question_type_id)
      }

      // Add WHERE clause parameter
      values.push(questionId)

      if (updates.length === 0) {
        return NextResponse.json({ 
          error: "No valid fields to update" 
        }, { status: 400 })
      }

      const query = `UPDATE questions SET ${updates.join(", ")} WHERE id = ?`
      
      console.log("📝 Executing query:", {
        query,
        values,
        updates
      })

      const [result]: any = await connection.execute(query, values)
      
      console.log("✅ Database update successful:", {
        affectedRows: result.affectedRows,
        changedRows: result.changedRows
      })

      return NextResponse.json({ 
        success: true, 
        id: questionId,
        message: "Question updated successfully",
        affectedRows: result.affectedRows
      })
    } catch (error: any) {
      console.error("❌ Database error:", error.message || error)
      return NextResponse.json({ 
        error: "Database error: " + (error.message || "Unknown error") 
      }, { status: 500 })
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error("❌ Route handler error:", error.message || error)
    return NextResponse.json({ 
      error: "Server error: " + (error.message || "Unknown error") 
    }, { status: 500 })
  }
}

// Các hàm GET và DELETE cũng cần sửa tương tự
export async function GET(request: NextRequest) {
  try {
    const params = await getParams(request)
    const questionId = parseInt(params.id, 10)
    
    console.log("🔍 API GET /api/questions/[id] called:", {
      questionId,
      url: request.url
    })

    if (isNaN(questionId)) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 })
    }

    // ... rest of GET function remains
    return NextResponse.json({ test: "GET works", questionId })
  } catch (error) {
    console.error("GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function checkOwnership(connection: any, questionId: number, userId: number): Promise<void> {
  const [rows]: any = await connection.execute(
    `SELECT q.id, e.user_id 
     FROM questions q 
     JOIN exercises e ON q.exercise_id = e.id 
     WHERE q.id = ?`,
    [questionId]
  );

  if (rows.length === 0) {
    throw new Error(`Question not found (ID: ${questionId})`);
  }

  if (rows[0].user_id !== userId) {
    throw new Error("Forbidden: You do not own this question");
  }
}

export async function DELETE(request: NextRequest) {
  let connection: any;

  try {
    const params = await getParams(request);
    const questionId = parseInt(params.id, 10);

    console.log("🔍 API DELETE /api/questions/[id] called:", {
      url: request.url,
      questionId
    });

    if (isNaN(questionId) || questionId <= 0) {
      return NextResponse.json(
        { error: `Invalid question ID: ${params.id}` },
        { status: 400 }
      );
    }

    const userId = await getUserId(request);

    connection = await pool.getConnection();

    // ✅ Check quyền sở hữu
    await checkOwnership(connection, questionId, userId);

    // ✅ Lấy exercise_id trước khi xóa
    const [questionRows]: any = await connection.execute(
      "SELECT exercise_id FROM questions WHERE id = ?",
      [questionId]
    );

    if (questionRows.length === 0) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    const exerciseId = questionRows[0].exercise_id;

    // ✅ Xóa answers
    await connection.execute(
      "DELETE FROM answers WHERE question_id = ?",
      [questionId]
    );

    // ✅ Xóa question
    const [result]: any = await connection.execute(
      "DELETE FROM questions WHERE id = ?",
      [questionId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // ✅ Cập nhật lại số câu hỏi của exercise
    await connection.execute(
      `
      UPDATE exercises
      SET num_questions = GREATEST(num_questions - 1, 0)
      WHERE id = ?
      `,
      [exerciseId]
    );

    console.log("✅ Delete question & update exercise success", {
      questionId,
      exerciseId
    });

    return NextResponse.json({
      success: true,
      message: "Question deleted and exercise updated successfully",
      deletedId: questionId,
      exerciseId
    });

  } catch (error: any) {
    console.error("❌ DELETE error:", error.message || error);

    const status =
      error.message?.includes("Unauthorized") ? 401 :
      error.message?.includes("Forbidden") ? 403 :
      error.message?.includes("not found") ? 404 : 500;

    return NextResponse.json(
      { error: error.message || "Server error" },
      { status }
    );
  } finally {
    if (connection) connection.release();
  }
}
