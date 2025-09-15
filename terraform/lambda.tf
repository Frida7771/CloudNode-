# SNS Topic for Email Verification
resource "aws_sns_topic" "email_verification" {
  name = "${var.project_name}-email-verification"

  tags = {
    Name = "${var.project_name}-email-verification"
  }
}

# Lambda IAM Role
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-lambda-role"
  }
}

# Lambda IAM Policy
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.sendgrid.arn
      }
    ]
  })
}

# Secrets Manager for SendGrid API Key
resource "aws_secretsmanager_secret" "sendgrid" {
  name = "${var.project_name}-sendgrid-credentials"

  tags = {
    Name = "${var.project_name}-sendgrid-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "sendgrid" {
  secret_id = aws_secretsmanager_secret.sendgrid.id
  secret_string = jsonencode({
    apiKey = var.sendgrid_api_key
  })
}

# Lambda Function
resource "aws_lambda_function" "email_verification" {
  filename         = "${path.module}/../serverless/lambda.zip"
  function_name    = "${var.project_name}-email-verification"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  memory_size     = 128

  environment {
    variables = {
      SENDGRID_SECRET_ID = aws_secretsmanager_secret.sendgrid.name
      FROM_EMAIL        = var.from_email
      DOMAIN           = var.domain_name != "" ? "${var.subdomain}.${var.domain_name}" : ""
    }
  }

  tags = {
    Name = "${var.project_name}-email-verification"
  }
}

# Lambda Permission for SNS
resource "aws_lambda_permission" "allow_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email_verification.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.email_verification.arn
}

# SNS Subscription
resource "aws_sns_topic_subscription" "email_verification" {
  topic_arn = aws_sns_topic.email_verification.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.email_verification.arn
}
