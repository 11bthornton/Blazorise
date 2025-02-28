namespace Blazorise.PdfViewer;

/// <summary>
/// Provides data for the PDF print-requested event, including the page number.
/// </summary>
public class PdfPrintRequestedEventArgs
{
    /// <summary>
    /// Initializes a new instance of the <see cref="PdfPrintRequestedEventArgs"/> class
    /// with the specified page number.
    /// </summary>
    /// <param name="pageNumber">The current page number of the PDF document.</param>
    public PdfPrintRequestedEventArgs( int pageNumber )
    {
        PageNumber = pageNumber;
    }

    /// <summary>
    /// Gets the current page number of the PDF document.
    /// </summary>
    public int PageNumber { get; }
}