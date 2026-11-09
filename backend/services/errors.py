class ServiceError(Exception):
    status_code = 400
    message = "The request could not be completed."

    def __init__(self, message=None):
        self.message = message or self.message
        super().__init__(self.message)
